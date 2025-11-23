import { Response } from "express";
import { CustomRequest } from "../types/express";
import { handleError2 } from "../service/error-handling";
import { StatusCodes } from "http-status-codes";
import { TIMEZONE } from "../constant";
import { StoreQueryType, TimePeriod, ValidatedStoreDatesType } from "../types";
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
    const storeScope = req.query.storeScope as string | undefined;

    // let finalStoreIds: string[] = authorizedStoreIds;
    let finalStoreIds: string[] = [];

    let storeQueryType: StoreQueryType;

    if (userRole === UserRoleEnum.MANAGER) {
        if (targetStoreId) {
            // Manager requests a single store (Branch A, Branch B, or even the Main store)
            if (authorizedStoreIds.includes(targetStoreId)) {
                finalStoreIds = [targetStoreId];
                storeQueryType = "Targeted Store";
            } else {
                // Invalid targetStoreId - fallback to the main store
                finalStoreIds = [storeId];
                storeQueryType = "Main Store";
            }
        } else if (storeScope === "all") {
            // Manager explicitly requests ALL stores combined (Main + Branches)
            finalStoreIds = authorizedStoreIds;
            storeQueryType = "All Stores (Aggregated)";
        } else {
            // DEFAULT BEHAVIOR (No params passed) -> Show ONLY the Main Store
            finalStoreIds = [storeId];
            storeQueryType = "Main Store";
        }
    } else {
        // Admin/User/Guest logic remains the same: always their single assigned store
        finalStoreIds = [storeId];
        storeQueryType = "Main Store";
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
        storeQueryType,
    };
};
