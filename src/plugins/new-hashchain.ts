import { gql, makeExtendSchemaPlugin } from "postgraphile/utils";
import { superuserPool, withPgPoolTransaction } from "@moneypot/caas/db";
import { constant, context, object, sideEffect } from "postgraphile/grafast";
import config from "@moneypot/caas/config";
import { PluginContext } from "@moneypot/caas";
import { getHash } from "@moneypot/hash-herald";
import { exactlyOneRow } from "../db/util.js";
import { HashchainTooOldError } from "./errors.js";
import { GraphQLError } from "graphql";

export const NewHashchainPlugin = makeExtendSchemaPlugin(() => {
  return {
    typeDefs: gql`
      input NewHashchainInput {
        clientSeed: String!
      }

      type NewHashchainPayload {
        hashchainId: UUID!
        query: Query
      }

      extend type Mutation {
        newHashchain(input: NewHashchainInput!): NewHashchainPayload
      }
    `,
    plans: {
      Mutation: {
        newHashchain(_, { $input }) {
          const $session = context<PluginContext>().get("session");
          const $hashchainId = sideEffect(
            [$input, $session],
            ([input, session]) => {
              if (!session) {
                throw new GraphQLError("You must be logged in");
              }

              return withPgPoolTransaction(superuserPool, async (pgClient) => {
                const { clientSeed } = input;

                // Toggle off any existing hashchains
                await pgClient.query({
                  text: `
                  UPDATE app_public.hashchain
                  SET active = false
                  WHERE user_id = $1 
                    AND experience_id = $2 
                    AND casino_id = $3 
                    AND active = true
                `,
                  values: [
                    session.user_id,
                    session.experience_id,
                    session.casino_id,
                  ],
                });

                const hashchain = await pgClient
                  .query<{ id: string }>({
                    text: `
                  INSERT INTO app_public.hashchain (user_id, experience_id, casino_id, client_seed, active)
                  VALUES ($1, $2, $3, $4, $5)
                  RETURNING id
                `,
                    values: [
                      session.user_id,
                      session.experience_id,
                      session.casino_id,
                      clientSeed,
                      true,
                    ],
                  })
                  .then(exactlyOneRow);

                const terminalHashResponse = await getHash(
                  config.HASHCHAINSERVER_OPTS,
                  {
                    hashchainId: hashchain.id,
                    iterations: 10_000,
                    context: {
                      event: {
                        $case: "fetchingTerminalHash",
                        value: {},
                      },
                    },
                  }
                );

                switch (terminalHashResponse.resp?.$case) {
                  case "hash":
                    break;
                  case "hashchainTooOldError":
                    throw new HashchainTooOldError();
                  default:
                    throw new GraphQLError("Unexpected terminal hash response");
                }

                const terminalHash = terminalHashResponse.resp.value;

                // Insert terminal hash
                await pgClient
                  .query({
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
                      10_000,
                      terminalHash,
                    ],
                  })
                  .then(exactlyOneRow);

                return hashchain.id;
              });
            }
          );

          return object({
            hashchainId: $hashchainId,
          });
        },
      },
      NewHashchainPayload: {
        query() {
          return constant(true);
        },
        hashchainId($data) {
          return $data.get("hashchainId");
        },
      },
    },
  };
});
