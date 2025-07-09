import 'dotenv/config';
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../schema/users-schema";
// import schema from "./schema";


export const pool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || "5432"),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    // connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production",
});


const db = drizzle(pool, { schema });

export default db;

// export const connect = async () => pool.connect();
export const connect = async () => {
    try {
        await pool.connect();
    } catch (error) {
        console.error('Error connecting to the database:', error);
        throw error;
    }
};
