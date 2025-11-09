import { rateLimit } from "express-rate-limit";

export const expressRateLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    standardHeaders: true, // Return rate limit info in the headers
    legacyHeaders: false, // Disable the X-RateLimit headers
    message: "Too many requests from this IP, please try again later.",
});
