/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response, NextFunction } from "express";
import { handleError } from "../service/error-handling";
import { StatusCodeEnum, UserRoleEnum } from "../types/enums";
import { AuthUserT } from "../config/auth-config";

interface AuthenticatedRequest extends Request {
    user?: AuthUserT;
}

/**
 * Middleware to ensure that Admins and Users can only access resources
 * associated with their own store.
 */
export const checkStoreAccess = (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
) => {
    const user = req.user?.data;

    if (!user) {
        return handleError(
            res,
            "Authentication error.",
            StatusCodeEnum.UNAUTHORIZED,
        );
    }

    // Managers have access to everything, so we let them pass.
    if (user.role === UserRoleEnum.MANAGER) {
        return next();
    }

    // For Admins and Users, they must be associated with a store.
    if (!user.storeId) {
        return handleError(
            res,
            "Access denied. Not assigned to a store.",
            StatusCodeEnum.FORBIDDEN,
        );
    }

    // This middleware's primary job is to attach the user's storeId to the request
    // so downstream controllers can use it for filtering data.
    // We can call this property `userStoreId` to be clear.
    (req as any).userStoreId = user.storeId;

    return next();
};
