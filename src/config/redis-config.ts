import { createClient } from "redis";
import { getEnvVariable } from "../utils";
import { getPassword } from "../utils/secret";

const redisHost = getEnvVariable("REDIS_HOST");
const redisPort = getEnvVariable("REDIS_PORT");
const redisPassword = getPassword("REDIS_PASSWORD", "REDIS_PASSWORD_FILE_PATH");

const redisClient = createClient({
    url: `redis://:${redisPassword}@${redisHost}:${redisPort}`,
});

redisClient.on("error", (err) => console.log("Redis Client Error", err));

const connectRedis = async () => {
    try {
        await redisClient.connect();
        console.log("Redis client connected successfully");
    } catch (err) {
        console.error("Could not connect to Redis", err);
        process.exit(1);
    }
};

export { redisClient, connectRedis };
