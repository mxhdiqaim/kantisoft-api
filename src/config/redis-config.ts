import { getEnvVariable } from "../utils";
import { createClient } from "redis"; // Correct import for node-redis v4+

// Make full URL Priority for cloud hosting
const REDIS_URL = getEnvVariable("REDIS_URL");
const NODE_ENV = getEnvVariable("NODE_ENV");

const REDIS_PORT = parseInt(getEnvVariable("REDIS_PORT") || "6379");
const REDIS_HOST = getEnvVariable("REDIS_HOST");
const REDIS_PASSWORD = getEnvVariable("REDIS_PASSWORD");

const clientOptions =
    NODE_ENV === "production"
        ? { url: REDIS_URL }
        : {
              socket: {
                  host: REDIS_HOST || "kantisoft-redis-dev",
                  port: REDIS_PORT,
                  connectTimeout: 10000, // add explicit timeout to avoid hanging
                  reconnectStrategy: (retries: number) => {
                      if (retries > 3) {
                          console.error("Max Redis connection retries reached");
                          return new Error("Max retries reached");
                      }
                      return Math.min(retries * 200, 3000);
                  },
              },
              password: REDIS_PASSWORD || undefined,
          };

const client = createClient(clientOptions);

// Export without connecting
export default client;

// Export a connect function
export const connectRedis = async () => {
    if (client.isReady) return;

    await client.connect();
    console.log("Redis client connected successfully.");
};

// // connect to Redis server
// client
//     .connect()
//     .then(() => {
//         console.log("Redis client connected successfully.");
//     })
//     .catch((err) => {
//         console.error("Redis Connection error:", err);
//         process.exit(1);
//     });
