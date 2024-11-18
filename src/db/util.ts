import { QueryResult, QueryResultRow } from "pg";
import { PgClientResult } from "postgraphile/@dataplan/pg";
import { assert } from "tsafe";

type ResultType<T> =
  | PgClientResult<T>
  | QueryResult<T extends QueryResultRow ? T : never>;

// These versions work with both datablan/pg and pg's query results.
export function maybeOneRow<T>(result: ResultType<T>): T | undefined {
  assert(result.rows.length <= 1);
  return result.rows[0];
}

export function exactlyOneRow<T>(result: ResultType<T>): T {
  assert(result.rows.length === 1);
  return result.rows[0];
}
