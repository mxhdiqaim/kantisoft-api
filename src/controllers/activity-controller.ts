import { Request, Response } from "express";
import db from "../db";
import { activityLog } from "../schema/activity-log-schema";
import { handleError } from "../service/error-handling";
import { StatusCodeEnum } from "../types/enums";
import { desc } from "drizzle-orm";

export const getActivities = async (req: Request, res: Response) => {
    try {
        const { limit = 20, offset = 0 } = req.query;

        const activities = await db.query.activityLog.findMany({
            orderBy: [desc(activityLog.createdAt)],
            limit: Number(limit),
            offset: Number(offset),
            with: {
                user: {
                    columns: {
                        firstName: true,
                        lastName: true,
                    },
                },
                store: {
                    columns: {
                        name: true,
                    },
                },
            },
        });

        res.status(StatusCodeEnum.OK).json(activities);
    } catch (error) {
        console.error("Failed to fetch activities:", error);
        handleError(
            res,
            "Failed to fetch activities.",
            StatusCodeEnum.INTERNAL_SERVER_ERROR,
        );
    }
};
