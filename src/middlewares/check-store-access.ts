import { Response, NextFunction } from "express";
import { handleError } from "../service/error-handling";
import { StatusCodeEnum } from "../types/enums";
import { CustomRequest } from "../types/express";

/**
 * Middleware to ensure that Admins and Users can only access resources
 * associated with their own store.
 */
export const checkStoreAccess = (
    req: CustomRequest,
    res: Response,
    next: NextFunction,
) => {
    const currentUser = req.user?.data; // req.user is typed from CustomRequest / global augmentation

    if (!currentUser || !currentUser.storeId) {
        return handleError(
            res,
            "Authentication required or user not associated with a store.",
            StatusCodeEnum.UNAUTHORIZED,
        );
    }

    // This is the crucial line: Set `userStoreId` on the request object.
    req.userStoreId = currentUser.storeId;

    return next();
};
