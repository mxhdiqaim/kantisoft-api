import moment from "moment-timezone";
import { DateInput, FilterDates, Period as TimePeriod } from "../types";

/**
 * @desc Determines the final start and end dates for filtering based on priority:
 * 1. Custom start/end dates (a DD/MM/YYYY format is assumed for string input).
 * 2. Relative period ('today', 'week', 'month').
 * 3. Default to 'all-time' if no criteria are met.
 * @param timePeriod - Optional relative period ('today', 'week', 'month', 'all-time').
 * @param customStartDate - Optional user-defined start date string (e.g. DD/MM/YYYY).
 * @param customEndDate - Optional user-defined end date string (e.g. DD/MM/YYYY).
 * @param timezone - The timezone used for all calculations (e.g. "Africa/Lagos").
 * @returns An object containing the final start/end Date objects and the determined period type.
 */
export const getFilterDates = (
    timePeriod: TimePeriod | undefined = "today",
    customStartDate: DateInput,
    customEndDate: DateInput,
    timezone: string = "Africa/Lagos",
): FilterDates => {
    const now = moment().tz(timezone);

    let startDate: Date | undefined = undefined;
    let endDate: Date | undefined = undefined;
    let periodUsed: TimePeriod | "custom" | "all-time";

    // 1. HIGH PRIORITY: Handle Custom Date Range
    if (customStartDate && customEndDate) {
        // Assume custom dates are provided in DD/MM/YYYY format (as per previous context)
        // Parse the input strings and set to start/end of day in the specified timezone for filtering accuracy.
        const startMoment = moment(customStartDate, "DD/MM/YYYY", true).tz(
            timezone,
        );
        const endMoment = moment(customEndDate, "DD/MM/YYYY", true).tz(
            timezone,
        );

        // Basic validation: If parsing failed (Invalid Date), treat it as undefined
        if (startMoment.isValid() && endMoment.isValid()) {
            periodUsed = "custom";
            startDate = startMoment.startOf("day").toDate();
            endDate = endMoment.endOf("day").toDate();
            return { startDate, endDate, periodUsed }; // Early return now safe
        }
    }

    // SECOND PRIORITY: Handle Relative Periods (only if custom dates weren't valid/provided)
    if (timePeriod && timePeriod !== "all-time") {
        periodUsed = timePeriod;
        const startOfPeriod = now.clone();

        switch (timePeriod) {
            case "today":
                startDate = startOfPeriod.startOf("day").toDate();
                endDate = startOfPeriod.endOf("day").toDate();
                break;
            case "week":
                // moment().startOf('week') defaults to Sunday unless configured globally
                startDate = startOfPeriod.startOf("week").toDate();
                endDate = startOfPeriod.endOf("week").toDate();
                break;
            case "month":
                startDate = startOfPeriod.startOf("month").toDate();
                endDate = startOfPeriod.endOf("month").toDate();
                break;
            default:
                // Should not happen, but catches an unknown period string
                periodUsed = "all-time";
        }
        // LOWEST PRIORITY: Default to All Time
    } else {
        periodUsed = "all-time";
        // Dates remain undefined, resulting in no filtering
    }

    return { startDate, endDate, periodUsed };
};

// Utility to get start/end of day/week/month in a specific timezone
export const getPeriodDates = (
    period: TimePeriod = "today",
    timezone: string = "Africa/Lagos",
) => {
    const now = moment().tz(timezone);
    let startDate: Date | null = null;
    let endDate: Date | null = null;

    switch (period) {
        case "today":
            startDate = now.clone().startOf("day").toDate();
            endDate = now.clone().endOf("day").toDate();
            break;
        case "week":
            startDate = now.clone().startOf("week").toDate();
            endDate = now.clone().endOf("week").toDate();
            break;
        case "month":
            startDate = now.clone().startOf("month").toDate();
            endDate = now.clone().endOf("month").toDate();
            break;
        case "all-time":
            // No specific start/end dates for all-time
            break;
        default:
            throw new Error("Invalid period specified");
    }
    return { startDate, endDate };
};
