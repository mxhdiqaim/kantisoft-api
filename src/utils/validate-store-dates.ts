import { Response } from "express";
import { CustomRequest } from "../types/express";
import { handleError2 } from "../service/error-handling";
import { StatusCodes } from "http-status-codes";
import { TIMEZONE } from "../constant";
import { TimePeriod, ValidatedStoreDatesType } from "../types";
import { getFilterDates } from "./get-filter-dates";
import { UserRoleEnum } from "../types/enums";
import { getUserStoreScope } from "./get-store-scope";

export const validateStoreAndExtractDates = async (
    req: CustomRequest,
    res: Response,
): Promise<ValidatedStoreDatesType | null> => {
    const currentUser = req.user?.data;
    const storeId = currentUser?.storeId;
    const userRole = currentUser?.role as UserRoleEnum;
    // const timezone = currentUser?.timezone || TIMEZONE;

    if (!storeId || !userRole) {
        handleError2(
            res,
            "User must belong to a store and have a defined role to access this feature.",
            StatusCodes.FORBIDDEN,
        );
        return null;
    }

    // Determine the authorised scope of stores
    const authorizedStoreIds = await getUserStoreScope(userRole, storeId);

    if (!authorizedStoreIds || authorizedStoreIds.length === 0) {
        handleError2(
            res,
            "Could not determine the user's store scope.",
            StatusCodes.INTERNAL_SERVER_ERROR,
        );
        return null;
    }

    // Handle Manager Override for Single Store View
    // Managers can pass 'targetStoreId' to view one store from their scope.
    const targetStoreId = req.query.targetStoreId as string | undefined;

    let finalStoreIds: string[] = authorizedStoreIds;

    if (userRole === UserRoleEnum.MANAGER && targetStoreId) {
        // Validate that the requested store ID is actually in the manager's authorised scope
        if (authorizedStoreIds.includes(targetStoreId)) {
            finalStoreIds = [targetStoreId]; // Override to single store view
        } else {
            handleError2(
                res,
                "Requested store is outside the authorized scope for this manager.",
                StatusCodes.FORBIDDEN,
            );
            return null;
        }
    } else if (userRole === UserRoleEnum.MANAGER && !targetStoreId) {
        // If Manager and no target are specified, the default is ALL authorised stores (aggregation).
        // finalStoreIds remains as authorizedStoreIds.
    } else {
        // Admins/Users/Guests must only see their assigned single store.
        finalStoreIds = [storeId];
    }

    const timePeriod = req.query.timePeriod as string | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    // const timezone = req.query.timezone as string | undefined;

    const {
        startDate: finalStartDate,
        endDate: finalEndDate,
        periodUsed,
    } = getFilterDates(
        timePeriod as TimePeriod | undefined,
        startDate,
        endDate,
        TIMEZONE,
    );

    return {
        storeIds: finalStoreIds,
        finalStartDate,
        finalEndDate,
        periodUsed,
    };
};
