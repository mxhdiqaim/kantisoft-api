import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
// import * as schema from "../schema/users-schema";
import schema from "./schema";

export let pool: Pool;

// Conditional Pool configuration based on NODE_ENV
if (process.env.NODE_ENV === "production") {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
        throw new Error(
            "DATABASE_URL environment variable is not set in production. Please configure it.",
        );
    }

    pool = new Pool({
        connectionString: connectionString,
        ssl: {
            rejectUnauthorized: false, // Often needed for Render's internal connections
        },
    });
} else {
    // Development/Local environment configuration
    pool = new Pool({
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT || "5432"),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
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
