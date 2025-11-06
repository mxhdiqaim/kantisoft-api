import { rateLimit, RateLimitRequestHandler } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import redisClient from "../config/redis-config";
import { StatusCodes } from "http-status-codes";

let apiLimiter: RateLimitRequestHandler;

export const initializeApiLimiter = () => {
    const apiStore = new RedisStore({
        sendCommand: (...args: string[]) => {
            return redisClient.sendCommand(args);
        },
        prefix: "rl:api:",
    });

    apiLimiter = rateLimit({
        store: apiStore,
        windowMs: 15 * 60 * 1000,
        max: 100,
        standardHeaders: true,
        legacyHeaders: false,
        message: {
            status: StatusCodes.TOO_MANY_REQUESTS,
            message: "Too many requests, please try again after 15 minutes.",
        },
    });
};

export const getApiLimiter = () => {
    if (!apiLimiter) {
        throw new Error(
            "API limiter not initialized. Call initializeApiLimiter first.",
        );
    }
    return apiLimiter;
};
