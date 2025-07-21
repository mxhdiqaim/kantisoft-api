import moment from "moment-timezone";
import { Period } from "../types";

// Utility to get start/end of day/week/month in a specific timezone
export const getPeriodDates = (
    period: Period = "today",
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
