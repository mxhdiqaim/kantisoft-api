import 'dotenv/config';
import { eq } from "drizzle-orm";
import db, { pool } from ".";
import { users, UserSchemaT } from "../schema/users-schema";
import { passwordHashService } from "../service/password-hash-service";

const createSeedAdmin = async () => {
    try {
        const data = {
            firstName: "Musa",
            lastName: "Ikechi",
            email: "admin@example.com",
            password: passwordHashService("password123"),
            role: "admin",
            status: "active",
            phone: "",
        } as UserSchemaT;

        const exist = await db.query.users.findFirst({
            where: eq(users.email, data.email),
        });

        if (exist) {
            console.log("Admin already exists");
            return;
        }

        const result = await db.insert(users).values(data).returning();
        console.log("Created admin:", result[0].email);
    } catch (error) {
        console.error("Error in createSeedAdmin:", error);
        throw error; // rethrow to be caught by the main seed function
    }
};

const runSeed = async () => {
    console.log("🌱 Starting seed...");
    try {
        await createSeedAdmin();
        console.log("✅ Seed successful!");
    } catch (error) {
        console.error("❌ Seed failed", error);
        process.exit(1);
    } finally {
        await pool.end(); // properly close the pool
        console.log("🔌 Pool ended.");
    }
};

const seed = async () => {
    const client = await pool.connect();
    await runSeed();
    client.release(true);
    console.log("Seed done");
};

seed().then(r => console.log(r)).catch(e => console.error(e));
