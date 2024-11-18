// GraphQLError that client should want to handle

import { GraphQLError } from "graphql";

export class HashchainTooOldError extends GraphQLError {
  constructor() {
    super("Hashchain too old.", {
      extensions: {
        code: "HASHCHAIN_EXPIRED",
      },
    });
  }
}

export class HashchainDrainedError extends GraphQLError {
  constructor() {
    super("Hashchain drained", {
      extensions: {
        code: "HASHCHAIN_EXPIRED",
      },
    });
  }
}
