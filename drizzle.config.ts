import "dotenv/config";
import { defineConfig } from "drizzle-kit";
import { URL } from "url";

// Conditionally set dbCredentials based on NODE_ENV
let dbCredentials;
if (process.env.NODE_ENV === "production") {
    // Parse the DATABASE_URL to extract credentials
    const dbUrl = new URL(process.env.DATABASE_URL!);
    dbCredentials = {
        host: dbUrl.hostname,
        port: Number(dbUrl.port),
        user: dbUrl.username,
        password: dbUrl.password,
        database: dbUrl.pathname.replace(/^\//, ""),
        ssl: true,
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
