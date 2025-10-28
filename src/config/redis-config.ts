import Redis from "ioredis";
import { getEnvVariable } from "../utils";

const REDIS_PORT = parseInt(getEnvVariable("REDIS_PORT") || "6379");
const REDIS_HOST = getEnvVariable("REDIS_HOST");
const REDIS_PASSWORD = getEnvVariable("REDIS_PASSWORD");

const redisClient = new Redis({
    port: REDIS_PORT,
    // port: 6379,
    host: REDIS_HOST || "localhost",
    password: REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null,
});

redisClient.on("connect", () => {
    console.log("Redis client connected");
});

redisClient.on("error", (err) => {
    console.error("Redis Connection error: ", err);
});

export default redisClient;
