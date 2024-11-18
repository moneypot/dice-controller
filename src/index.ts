import "dotenv/config";
import { defaultPlugins, ServerOptions, startAndListen } from "@moneypot/caas";
import { MakeDiceBetPlugin } from "./plugins/make-dice-bet.js";
import path from "path";
import { NewHashchainPlugin } from "./plugins/new-hashchain.js";
import { SimpleResolverPlugin } from "./plugins/simple-resolver.js";

const options: ServerOptions = {
  extraPgSchemas: ["app_public"],
  plugins: [
    ...defaultPlugins,
    MakeDiceBetPlugin,
    NewHashchainPlugin,
    SimpleResolverPlugin,
  ],
  exportSchemaSDLPath: path.join(import.meta.dirname, "../schema.graphql"),
  userDatabaseMigrationsPath: path.join(import.meta.dirname, "../pg-versions"),
};

startAndListen(options, () => {
  console.log("Server is running");
});
