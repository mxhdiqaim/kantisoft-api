import "dotenv/config";
import { defineConfig } from "drizzle-kit";
import { getEnvVariable } from "./src/utils";

// Conditionally set dbCredentials based on NODE_ENV
let dbCredentials;
const NODE_ENV = getEnvVariable("NODE_ENV");
// const postgresSsl = getEnvVariable("POSTGRES_SSL_REQUIRED") == "true";
if (NODE_ENV === "production") {
    const host = getEnvVariable("POSTGRES_HOST");
    const port = getEnvVariable("POSTGRES_PORT");
    const user = getEnvVariable("POSTGRES_USER");
    const database = getEnvVariable("POSTGRES_DB");
    const sslRequired = getEnvVariable("POSTGRES_SSL_REQUIRED") == "true";

    // Read the password from the secret file path
    const password = getEnvVariable("POSTGRES_PASSWORD_FILE_PATH");
    // const dbUrl = new URL(process.env.POSTGRES_URL!);
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
        host: process.env.POSTGRES_HOST!,
        port: Number(process.env.POSTGRES_PORT),
        user: process.env.POSTGRES_USER!,
        password: process.env.POSTGRES_PASSWORD!,
        database: process.env.POSTGRES_DB!,
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
