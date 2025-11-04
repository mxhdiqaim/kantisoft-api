import Redis from "ioredis";
import { getEnvVariable } from "../utils";

const REDIS_PORT = parseInt(getEnvVariable("REDIS_PORT") || "6379");
const REDIS_HOST = getEnvVariable("REDIS_HOST");
const REDIS_PASSWORD = getEnvVariable("REDIS_PASSWORD");

// init redis client
const redisClient = new Redis({
    port: REDIS_PORT,
    host: REDIS_HOST || "localhost",
    password: REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null,
});

// Redis client event handlers (only for logging)
redisClient.on("connect", () => {
    // This confirms connectivity for the user
    console.log("Redis client connected successfully.");
});

redisClient.on("error", (err) => {
    // This logs connection failure without stopping the server process
    console.error("Redis Connection error:", err);
});

export default redisClient;
