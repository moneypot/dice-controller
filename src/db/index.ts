import { PoolClient } from "pg";
import { DbHash, DbHashchain } from "./types.js";
import { exactlyOneRow, maybeOneRow } from "./util.js";

// Gets the latest active hashchain or inserts one if none exist for {user_id, experience_id, casino_id}.
//
// For now, it's assumed to be the user's responsibility to end active mines games before making dice bets.
export async function upsertHashchain(
  pgClient: PoolClient,
  fields: {
    user_id: string;
    experience_id: string;
    casino_id: string;
  }
) {
  return pgClient
    .query<DbHashchain>({
      text: `
      WITH new_hashchain AS (
        INSERT INTO app_public.hashchain (user_id, experience_id, casino_id, client_seed, active)
        VALUES ($1, $2, $3, '', true)
        ON CONFLICT (user_id, experience_id, casino_id) WHERE active = true
        DO NOTHING
        RETURNING *
      )
      SELECT * FROM new_hashchain
      UNION ALL
      SELECT * FROM app_public.hashchain
      WHERE user_id = $1 AND experience_id = $2 AND casino_id = $3 AND active = true
      AND NOT EXISTS (SELECT 1 FROM new_hashchain)
      LIMIT 1;
    `,
      values: [fields.user_id, fields.experience_id, fields.casino_id],
    })
    .then(exactlyOneRow);
}

export async function latestHashForHashchainId(
  pgClient: PoolClient,
  hashchainId: string
) {
  return pgClient
    .query<DbHash>(
      `
      SELECT * 
      FROM app_public.hash
      WHERE hashchain_id = $1
      ORDER BY id DESC
      LIMIT 1
    `,
      [hashchainId]
    )
    .then(maybeOneRow);
}
