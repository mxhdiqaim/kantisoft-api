import { Request, Response, NextFunction } from "express";
import { handleError } from "../service/error-handling";
import { StatusCodeEnum, UserRoleEnum } from "../types/enums";
import { AuthUserT } from "../config/auth-config";

interface AuthenticatedRequest extends Request {
    user?: AuthUserT;
}

// A list of routes a manager can access before creating a store
const allowedOnboardingRoutes = [
    "/stores", // To create their first store
    "/users/update-password", // To change their password
    "/users/logout", // To log out
];

export const checkOnboarding = (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
) => {
    const user = req.user?.data;

    // This middleware only applies to managers
    if (!user || user.role !== UserRoleEnum.MANAGER) {
        return next();
    }

    // If the manager has no storeId, they are in the "onboarding" phase
    if (!user.storeId) {
        // Check if they are trying to access an allowed route
        if (
            allowedOnboardingRoutes.some((route) => req.path.startsWith(route))
        ) {
            return next(); // Allow access
        }

        // If not, block them with a specific message
        return handleError(
            res,
            "You must create a store before you can access this feature.",
            StatusCodeEnum.FORBIDDEN,
        );
    }

    // If the manager has a storeId, they have full access
    return next();
};
