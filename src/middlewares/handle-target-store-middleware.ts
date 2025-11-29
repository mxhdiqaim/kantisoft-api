import { NextFunction, Response } from "express";
import { CustomRequest } from "../types/express";
import { UserRoleEnum } from "../types/enums";
import { getStoreAndBranchIds } from "../service/store-service";
import { handleError2 } from "../service/error-handling";
import { StatusCodes } from "http-status-codes";

/**
 * Middleware to resolve which store(s) a request should apply to.
 * It populates `req.storeIds` with an array of store IDs.
 *
 * - For MANAGER:
 *   - If `targetStoreId` query param is present, it's parsed (can be comma-separated).
 *   - If not present, it defaults to the user's main store and all its branches.
 * - For other roles (e.g. ADMIN, USER or GUEST):
 *   - It defaults to the single storeId from their user token.
 */
export const handleTargetStore = async (
    req: CustomRequest,
    res: Response,
    next: NextFunction,
) => {
    const currentUser = req.user?.data;

    if (!currentUser || !currentUser.storeId) {
        // This should ideally be caught by `checkUserHasStore` middleware first
        return handleError2(
            res,
            "User not authenticated.",
            StatusCodes.UNAUTHORIZED,
        );
    }

    const targetStoreIdQuery = req.query.targetStoreId as string | undefined;
    const isManagerPrivileged = currentUser.role === UserRoleEnum.MANAGER;

    try {
        if (isManagerPrivileged && targetStoreIdQuery) {
            // Privileged user provided specific store(s)
            req.storeIds = targetStoreIdQuery.split(",").map((id) => id.trim());
        } else if (isManagerPrivileged) {
            // Manager and no specific target, so get all related stores
            const allRelatedStoreIds = await getStoreAndBranchIds(
                currentUser.storeId,
            );

            if (!allRelatedStoreIds) {
                return handleError2(
                    res,
                    "Could not resolve the request.",
                    StatusCodes.NOT_FOUND,
                );
            }

            req.storeIds = allRelatedStoreIds;
        } else {
            // Regular user (ADMIN, USER and GUEST) scope is limited to their own store
            req.storeIds = [currentUser.storeId];
        }

        // Ensuring storeIds is not empty
        if (!req.storeIds || req.storeIds.length === 0) {
            return handleError2(
                res,
                "Failed to complete the request.",
                StatusCodes.BAD_REQUEST,
            );
        }

        next();
    } catch (error) {
        handleError2(
            res,
            "An error occurred while processing store targeting.",
            StatusCodes.INTERNAL_SERVER_ERROR,
            error instanceof Error ? error : undefined,
        );
    }
};
