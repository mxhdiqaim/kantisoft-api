import "dotenv/config";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import db, { pool } from "./index";

const migrateDB = async () => {
    console.log("Migration start");
    const client = await pool.connect();
    await migrate(db, { migrationsFolder: "./migrations" });
    client.release(true);
    console.log("Migration done");
};

migrateDB()
    .then((r) => console.log(r))
    .catch((e) => console.error(e));
