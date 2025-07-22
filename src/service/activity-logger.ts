import db from "../db";
import { activityLog, activityActionEnum } from "../schema/activity-log-schema";

type LogActivityPayload = {
    userId?: string;
    storeId?: string;
    action: (typeof activityActionEnum.enumValues)[number];
    entityId?: string;
    entityType?: string;
    details: string;
};

export const logActivity = async (payload: LogActivityPayload) => {
    try {
        await db.insert(activityLog).values(payload);
    } catch (error) {
        // Log the error but don't block the main operation
        console.error("Failed to log activity:", error);
    }
};
