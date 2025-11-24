import {NextFunction, Response} from "express";
import {handleError2} from "../service/error-handling";
import {CustomRequest} from "../types/express";
import {StatusCodes} from "http-status-codes";

/**
 * Middleware to ensure that Admins and Users must be associated to a store.
 */
export const checkUserHasStore = (
    req: CustomRequest,
    res: Response,
    next: NextFunction,
) => {
    const currentUser = req.user?.data; // req.user is typed from CustomRequest / global augmentation
    const storeId = currentUser?.storeId;

    if (!currentUser || !storeId) {
        return handleError2(
            res,
            "Authentication required or user not associated with a store.",
            StatusCodes.UNAUTHORIZED,
        );
    }

    // This is the crucial line: Set `userStoreId` on the request object.
    // req.userStoreId = currentUser?.storeId;

    next();
};
