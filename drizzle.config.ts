import "dotenv/config";
import { defineConfig } from "drizzle-kit";
import { getEnvVariable } from "./src/utils";

// Conditionally set dbCredentials based on NODE_ENV
let dbCredentials;
const NODE_ENV = getEnvVariable("NODE_ENV");
if (NODE_ENV === "production") {
    const connectionString = getEnvVariable("DB_CONNECTION_STRING");
    const sslRequired = getEnvVariable("DB_SSL_REQUIRED") == "true";
    const dbUrl = new URL(connectionString);

    dbCredentials = {
        host: dbUrl.hostname,
        port: Number(dbUrl.port),
        user: dbUrl.username,
        password: dbUrl.password,
        database: dbUrl.pathname.replace(/^\//, ""),
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
