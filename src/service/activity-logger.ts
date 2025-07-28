import { InferInsertModel } from "drizzle-orm";
import db from "../db";
import { activityLog } from "../schema/activity-log-schema";

// Use InferInsertModel for strict type safety
type LogActivityPayload = InferInsertModel<typeof activityLog>;

export const logActivity = async (payload: LogActivityPayload) => {
    try {
        await db.insert(activityLog).values(payload);
    } catch (error) {
        // Log the error but don't block the main operation.
        // In a production app, I will consider using a dedicated logging library (e.g., Winston, Pino)
        // and sending errors to a monitoring service.
        console.error("Failed to log activity:", error);
    }
};
