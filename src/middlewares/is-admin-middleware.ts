import { Request, Response, NextFunction } from "express";
import { handleError } from "../service/error-handling";
import { StatusCodeEnum } from "../types/enums";

import { type AuthUserT } from "../config/auth-config";

// This is a placeholder. You should have a custom Request type that includes your user object.
interface AuthenticatedRequest extends Request {
    user?: AuthUserT;
}

export const isAdmin = (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
) => {
    // Assumes a previous middleware has authenticated the user and attached user info to req.user
    if (req.user && req.user.data && req.user.data.role === "admin") {
        return next();
    }
    return handleError(
        res,
        "Access denied. You do not have permission to perform this action.",
        StatusCodeEnum.FORBIDDEN,
    );
};
