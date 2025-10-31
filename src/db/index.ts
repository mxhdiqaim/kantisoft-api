import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool, PoolConfig } from "pg";
import schema from "./schema";
import { getEnvVariable } from "../utils";

export let pool: Pool;

// Conditional Pool configuration based on NODE_ENV
const NODE_ENV = getEnvVariable("NODE_ENV");
if (NODE_ENV === "production") {
    const connectionString = getEnvVariable("DATABASE_URL");
    const sslRequired = getEnvVariable("DATABASE_SSL_REQUIRED") == "true";

    if (!connectionString) {
        throw new Error(
            "DATABASE_URL environment variable is not set in production. Please configure it.",
        );
    }

    const poolConfig: PoolConfig = {
        connectionString: connectionString,
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
