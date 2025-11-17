import { rateLimit } from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import { redisClient } from "../config/redis-config";

export const createRateLimiter = () =>
    rateLimit({
        windowMs: 60 * 1000, // 1 minute
        // max: 3, // limit each IP to 100 requests per windowMs
        max: 100, // limit each IP to 100 requests per windowMs
        standardHeaders: true, // Return rate limit info in the headers
        legacyHeaders: false, // Disable the X-RateLimit headers
        message: "Too many requests from this IP, please try again later.",
        store: new RedisStore({
            sendCommand: (...args: string[]) => redisClient.sendCommand(args),
        }),
    });
