import "dotenv/config";
import { defineConfig } from "drizzle-kit";
import { URL } from "url";
import { getEnvVariable } from "./src/utils";

// Conditionally set dbCredentials based on NODE_ENV
let dbCredentials;
const NODE_ENV = getEnvVariable("NODE_ENV");
const postgresSsl = getEnvVariable("POSTGRES_SSL_REQUIRED") == "true";
if (NODE_ENV === "production") {
    // Parse the DATABASE_URL to extract credentials
    const dbUrl = new URL(process.env.POSTGRES_URL!);
    dbCredentials = {
        host: dbUrl.hostname,
        port: Number(dbUrl.port),
        user: dbUrl.username,
        password: dbUrl.password,
        database: dbUrl.pathname.replace(/^\//, ""),
        ssl: postgresSsl,
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
