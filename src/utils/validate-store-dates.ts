import { Response } from "express";
import { CustomRequest } from "../types/express";
import { handleError2 } from "../service/error-handling";
import { StatusCodes } from "http-status-codes";
import { TIMEZONE } from "../constant";
import { TimePeriod } from "../types";
import { getFilterDates } from "./get-period-dates";

export const validateStoreAndExtractDates = (
    req: CustomRequest,
    res: Response,
) => {
    const currentUser = req.user?.data;
    const storeId = currentUser?.storeId;
    // const timezone = currentUser?.timezone || TIMEZONE;

    if (!storeId) {
        handleError2(
            res,
            "User must belong to a store to access this feature.",
            StatusCodes.BAD_REQUEST,
        );
        return null;
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

    return { storeId, finalStartDate, finalEndDate, periodUsed };
};
