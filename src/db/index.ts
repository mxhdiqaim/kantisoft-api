import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool, PoolConfig } from "pg";
import { readFileSync } from "fs";
import schema from "./schema";
import { getEnvVariable } from "../utils";

export let pool: Pool;

// Conditional Pool configuration based on NODE_ENV
export const NODE_ENV = getEnvVariable("NODE_ENV");

if (NODE_ENV === "production") {
    // Get non-secret variables from .env.prod
    const host = getEnvVariable("DB_HOST");
    const port = getEnvVariable("DB_PORT");
    const user = getEnvVariable("DB_USER");
    const database = getEnvVariable("DB_NAME");
    const sslRequired = getEnvVariable("DB_SSL_REQUIRED") == "true";

    // Read the password from the secret file
    const passwordFile = getEnvVariable("DB_PASSWORD_FILE");
    const password = readFileSync(passwordFile, "utf8").trim();

    // // Read the password from the secret file path
    // const password = getEnvVariable("DB_PASSWORD_FILE");

    // Construct the connection URL
    const connectionString = `postgresql://${user}:${password}@${host}:${port}/${database}`;

    const poolConfig: PoolConfig = {
        connectionString,
    };

    if (sslRequired) {
        poolConfig.ssl = {
            rejectUnauthorized: false, // Often needed for managed DBs
        };
    }

    pool = new Pool(poolConfig);
} else {
    // Development/Local environment configuration
    const host = getEnvVariable("DB_HOST");
    const port = Number(getEnvVariable("DB_PORT") || "5432");
    const user = getEnvVariable("DB_USER");
    const password = getEnvVariable("DB_PASSWORD");
    const database = getEnvVariable("DB_NAME");

    pool = new Pool({
        host,
        port,
        user,
        password,
        database,
    });
}
const db = drizzle(pool, { schema });

export default db;

export const connect = async () => {
    try {
        await pool.connect();
        console.log("Database connection pool established successfully.");
    } catch (error) {
        console.error("Error connecting to the database:", error);
        throw error; // Re-throw the error to indicate connection failure
    }
};
