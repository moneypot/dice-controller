import { constant, context, object, sideEffect } from "postgraphile/grafast";
import { gql, makeExtendSchemaPlugin } from "postgraphile/utils";
import { getHash, computeCrashDiceResult } from "@moneypot/hash-herald";
import { assert } from "tsafe";
import config from "@moneypot/caas/config";
import {
  superuserPool,
  withPgPoolTransaction,
  getActiveSessionById,
} from "@moneypot/caas/db";
import { PluginContext } from "@moneypot/caas";
import { exactlyOneRow, maybeOneRow } from "../db/util.js";
import { latestHashForHashchainId, upsertHashchain } from "../db/index.js";
import { DbHash } from "../db/types.js";
import { GraphQLError } from "graphql";
import { HashchainDrainedError, HashchainTooOldError } from "./errors.js";

// TODO: Configurable house edge
const HOUSE_EDGE = 0.01;

const MAX_TARGET = 10_000;
const HASH_ITERATIONS = 10_000;

export const MakeDiceBetPlugin = makeExtendSchemaPlugin((build) => {
  const diceBets = build.input.pgRegistry.pgResources.dice_bet;

  return {
    typeDefs: gql`
      input NewDiceBetInput {
        wager: Float!
        target: Float!
        currency: String!
      }

      type NewDiceBetPayload {
        diceBet: DiceBet!
        query: Query
      }

      extend type Mutation {
        makeDiceBet(input: NewDiceBetInput!): NewDiceBetPayload
      }
    `,
    plans: {
      Mutation: {
        makeDiceBet(_, { $input }) {
          const $session = context<PluginContext>().get("session");
          const $diceBetId = sideEffect(
            [$input, $session],
            ([input, session]) => {
              if (!session) {
                throw new GraphQLError("You must be logged in");
              }

              return withPgPoolTransaction(superuserPool, async (pgClient) => {
                const { wager, target, currency } = input;

                if (wager <= 0) {
                  throw new GraphQLError("Wager must be positive");
                }

                // Validate target
                if (target <= 1) {
                  throw new GraphQLError("Target must be greater than 1");
                }

                if (target > MAX_TARGET) {
                  throw new GraphQLError(
                    `Target must be less than or equal to ${MAX_TARGET}`
                  );
                }

                // Ensure currency is found in casino currency list
                const dbCurrency = await pgClient
                  .query<{ key: string }>({
                    text: `
                  SELECT key
                  FROM caas.currency
                  WHERE key = $1 AND casino_id = $2
                `,
                    values: [currency, session.casino_id],
                  })
                  .then(maybeOneRow);

                if (!dbCurrency) {
                  throw new GraphQLError("Currency not found");
                }

                // Lock the user's balance row and ensure they can afford the wager
                const balance = await pgClient
                  .query<{ amount: number }>({
                    text: `
                    select amount from caas.balance
                    where user_id = $1
                      and casino_id = $2
                      and experience_id = $3
                      and currency_key = $4
                    for update
                  `,
                    values: [
                      session.user_id,
                      session.casino_id,
                      session.experience_id,
                      currency,
                    ],
                  })
                  .then(maybeOneRow)
                  .then((row) => row?.amount);

                if (!balance || balance < wager) {
                  throw new GraphQLError("Insufficient funds for wager");
                }

                // Ensure the house can afford the potential payout
                // Lock the bankroll row
                const bankrollBalance = await pgClient
                  .query<{ amount: number }>({
                    text: `
                      select amount 
                      from caas.bankroll
                      where currency_key = $1 
                        and casino_id = $2 
                      for update
                    `,
                    values: [currency, session.casino_id],
                  })
                  .then(maybeOneRow)
                  .then((row) => row?.amount);

                if (
                  !bankrollBalance ||
                  bankrollBalance < wager * (target - 1)
                ) {
                  throw new GraphQLError("House cannot afford payout");
                }

                const hashchain = await upsertHashchain(pgClient, session);
                let prevHash = await latestHashForHashchainId(
                  pgClient,
                  hashchain.id
                );

                // If no prevHash, we insert a TERMINAL_HASH
                if (!prevHash) {
                  const initialIterations = HASH_ITERATIONS;
                  const terminalHashResponse = await getHash(
                    config.HASHCHAINSERVER_OPTS,
                    {
                      hashchainId: hashchain.id,
                      iterations: initialIterations,
                      context: {
                        event: {
                          $case: "fetchingTerminalHash",
                          value: {},
                        },
                      },
                    }
                  );

                  if (!terminalHashResponse.resp) {
                    throw new GraphQLError("No terminal hash response");
                  }

                  switch (terminalHashResponse.resp.$case) {
                    case "hash":
                      // Success
                      break;
                    case "hashchainTooOldError":
                      throw new HashchainTooOldError();
                    default:
                      throw new GraphQLError(
                        "Unexpected terminal hash response"
                      );
                  }

                  const terminalHash = terminalHashResponse.resp.value;

                  // insert hash
                  prevHash = await pgClient
                    .query<DbHash>({
                      text: `
                    INSERT INTO app_public.hash (type, hashchain_id, user_id, casino_id, experience_id, iteration, hash)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                    RETURNING *
                  `,
                      values: [
                        "TERMINAL_HASH",
                        hashchain.id,
                        session.user_id,
                        session.casino_id,
                        session.experience_id,
                        initialIterations,
                        terminalHash,
                      ],
                    })
                    .then(exactlyOneRow);
                }

                assert(prevHash, "impossible: prevHash should be defined");

                const iterations = prevHash.iteration - 1;

                // TODO: Handle hashchain drained
                if (iterations < 1) {
                  throw new HashchainDrainedError();
                }

                // Get next hash from hashchainserver
                const hashResponse = await getHash(
                  config.HASHCHAINSERVER_OPTS,
                  {
                    hashchainId: hashchain.id,
                    iterations,
                    context: {
                      event: {
                        $case: "crashDice",
                        value: {
                          amount: wager,
                          target,
                          houseEdge: HOUSE_EDGE,
                          playerSeed: hashchain.client_seed,
                        },
                      },
                    },
                  }
                );

                if (!hashResponse.resp) {
                  throw new GraphQLError("No hash response");
                }

                switch (hashResponse.resp.$case) {
                  case "hash":
                    // Success
                    break;
                  case "hashchainTooOldError":
                    throw new HashchainTooOldError();
                  default:
                    throw new GraphQLError("Unexpected hash response");
                }

                const crashDiceHash = hashResponse.resp.value;

                // Insert new hash and dicebet
                const dbHash = await pgClient
                  .query<{ id: string }>({
                    text: `
                  INSERT INTO app_public.hash (type, hashchain_id, user_id, casino_id, experience_id, iteration, hash)
                  VALUES ($1, $2, $3, $4, $5, $6, $7)
                  RETURNING id
                `,
                    values: [
                      "DICE_BET",
                      hashchain.id,
                      session.user_id,
                      session.casino_id,
                      session.experience_id,
                      iterations,
                      crashDiceHash,
                    ],
                  })
                  .then(exactlyOneRow);

                const actual = computeCrashDiceResult(
                  crashDiceHash,
                  hashchain.client_seed,
                  HOUSE_EDGE
                );
                const net = target <= actual ? wager * (target - 1) : -wager;

                // User balance
                await pgClient.query({
                  text: `
                    UPDATE caas.balance
                    SET amount = amount + $1 
                    WHERE user_id = $2 
                      AND casino_id = $3
                      AND experience_id = $4 
                      AND currency_key = $5
                  `,
                  values: [
                    net,
                    session.user_id,
                    session.casino_id,
                    session.experience_id,
                    currency,
                  ],
                });

                // Bankroll
                await pgClient.query({
                  text: `
                    UPDATE caas.bankroll
                    SET amount = amount - $1 
                    WHERE currency_key = $2
                      AND casino_id = $3
                  `,
                  values: [net, currency, session.casino_id],
                });

                const dbDiceBet = await pgClient
                  .query<{ id: string }>({
                    text: `
                  insert into app_public.dice_bet (id, wager, net, target, actual, currency_key, user_id, experience_id, casino_id)
                  values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                  returning id
                `,
                    values: [
                      dbHash.id,
                      wager,
                      net,
                      target,
                      actual,
                      currency,
                      session.user_id,
                      session.experience_id,
                      session.casino_id,
                    ],
                  })
                  .then(exactlyOneRow);

                // Update bankroll stats
                await pgClient.query({
                  text: `
                update caas.bankroll
                set bets = bets + 1,
                    wagered = wagered + $1,
                    expected_value = expected_value + ($1 * $2)
                where currency_key = $3
                  and casino_id = $4
              `,
                  values: [wager, HOUSE_EDGE, currency, session.casino_id],
                });

                return dbDiceBet.id;
              });
            }
          );

          return object({
            diceBetId: $diceBetId,
          });
        },
      },
      NewDiceBetPayload: {
        query() {
          return constant(true);
        },
        diceBet($data) {
          const $id = $data.get("diceBetId");
          return diceBets.get({ id: $id });
        },
      },
    },
  };
});
