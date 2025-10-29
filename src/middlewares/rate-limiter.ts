import { rateLimit } from "express-rate-limit";
import type { RedisReply } from "rate-limit-redis";
import { RedisStore } from "rate-limit-redis";
import redisClient from "../config/redis-config";
import { StatusCodes } from "http-status-codes";

const apiStore = new RedisStore({
    sendCommand: async (command: string, ...args: (string | number)[]) => {
        return (await redisClient.call(command, ...args)) as RedisReply;
    },
    prefix: "rl:api:", // Prefix for API limiter
});

export const apiLimiter = rateLimit({
    store: apiStore,
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    standardHeaders: true, // Return rate limit info in headers
    legacyHeaders: false, // Disable the X-Rate-Limit headers
    message: {
        status: StatusCodes.TOO_MANY_REQUESTS,
        message: "Too many requests, please try again after 15 minutes.",
    },
});
