import "dotenv/config";
import { defineConfig } from "drizzle-kit";
import { readFileSync } from "fs";
import { getEnvVariable } from "./src/utils";

// Conditionally set dbCredentials based on NODE_ENV
let dbCredentials;
const NODE_ENV = getEnvVariable("NODE_ENV");
// const postgresSsl = getEnvVariable("POSTGRES_SSL_REQUIRED") == "true";
if (NODE_ENV === "production") {
    const host = getEnvVariable("DB_HOST");
    const port = getEnvVariable("DB_PORT");
    const user = getEnvVariable("DB_USER");
    const database = getEnvVariable("DB_NAME");
    const sslRequired = getEnvVariable("DB_SSL_REQUIRED") == "true";

    // ✅ Read the password from the secret file
    const passwordFile = getEnvVariable("DB_PASSWORD_FILE");
    const password = readFileSync(passwordFile, "utf8").trim();

    // // Read the password from the secret file path
    // const password = getEnvVariable("DB_PASSWORD_FILE");

    dbCredentials = {
        host,
        port: Number(port),
        user,
        password,
        database,
        ssl: sslRequired,
    };
} else {
    dbCredentials = {
        host: process.env.DB_HOST!,
        port: Number(process.env.DB_PORT),
        user: process.env.DB_USER!,
        password: process.env.DB_PASSWORD!,
        database: process.env.DB_NAME!,
    };
}

export default defineConfig({
    dialect: "postgresql",
    schema: "./src/schema/*",
    out: "./migrations",
    dbCredentials: dbCredentials,
    verbose: true,
    strict: true,
});
