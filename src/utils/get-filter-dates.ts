import moment from "moment-timezone";
import { Period } from "../types";

// Define the expected input types for clarity
type DateInput = string | Date | undefined | null;

interface FilterDates {
    finalStartDate: Date | undefined;
    finalEndDate: Date | undefined;
    // Useful for logging/displaying in the report response
    periodUsed: Period | "custom" | "all-time";
}

/**
 * @desc Determines the final start and end dates for filtering, prioritising 'period' over custom dates.
 * @param period - Optional relative period ('today', 'week', 'month', 'all-time').
 * @param customStartDate - Optional user-defined start date string (YYYY-MM-DD).
 * @param customEndDate - Optional user-defined end date string (YYYY-MM-DD).
 * @param timezone - The timezone used to calculate relative periods (e.g. "Africa/Lagos").
 * @returns An object containing the final start/end Date objects and the determined period type.
 */
export const getFilterDates = (
    period: Period | undefined,
    customStartDate: DateInput,
    customEndDate: DateInput,
    timezone: string = "Africa/Lagos",
): FilterDates => {
    const now = moment().tz(timezone);
    let finalStartDate: Date | undefined = undefined;
    let finalEndDate: Date | undefined = undefined;
    let periodUsed: Period | "custom" | "all-time";

    // Prioritize Relative Periods
    if (period && period !== "all-time") {
        periodUsed = period;
        const startOfPeriod = now.clone();

        switch (period) {
            case "today":
                finalStartDate = startOfPeriod.startOf("day").toDate();
                finalEndDate = startOfPeriod.endOf("day").toDate();
                break;
            case "week":
                finalStartDate = startOfPeriod.startOf("week").toDate();
                finalEndDate = startOfPeriod.endOf("week").toDate();
                break;
            case "month":
                finalStartDate = startOfPeriod.startOf("month").toDate();
                finalEndDate = startOfPeriod.endOf("month").toDate();
                break;
            default:
                // Should not happen if 'all-time' is excluded, but handles unexpected string
                periodUsed = "all-time";
        }
    }
    // Handle Custom Date Range
    else if (customStartDate && customEndDate) {
        periodUsed = "custom";

        // Ensure custom dates are parsed and truncated to start/end of day for filtering accuracy
        finalStartDate = moment(customStartDate)
            .tz(timezone)
            .startOf("day")
            .toDate();
        finalEndDate = moment(customEndDate).tz(timezone).endOf("day").toDate();
    }
    // Default to All Time
    else {
        periodUsed = "all-time";
        // Dates remain undefined, resulting in no filtering
    }

    return { finalStartDate, finalEndDate, periodUsed };
};
