/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from "express";
import db from "../db";
import { activityLog } from "../schema/activity-log-schema";
import { users } from "../schema/users-schema";
import { stores } from "../schema/stores-schema";
import { handleError } from "../service/error-handling";
import { StatusCodeEnum, UserRoleEnum } from "../types/enums";
import { and, desc, eq, ne, sql, SQLWrapper } from "drizzle-orm";

export const getActivities = async (req: Request, res: Response) => {
    try {
        const { limit: queryLimit = 20, offset: queryOffset = 0 } = req.query;
        const limit = Math.max(1, Math.min(100, Number(queryLimit)));
        const offset = Math.max(0, Number(queryOffset));

        const currentUser = req.user?.data;
        const storeId = currentUser?.storeId;
        const role = currentUser?.role;

        if (!storeId || !role) {
            return handleError(
                res,
                "Unauthorized: User or store information missing.",
                StatusCodeEnum.UNAUTHORIZED,
            );
        }

        // Initialize base conditions for the current store
        const conditions: (SQLWrapper | undefined)[] = [
            eq(activityLog.storeId, storeId),
        ];

        let includeUsersTable = false; // Flag to determine if we need to join users table for filtering
        let selectUsersColumns = false; // Flag to determine if we need to select user details

        // Determine permissions and build core conditions
        if (role === UserRoleEnum.MANAGER) {
            // Managers see all activities for their store.
            // We want to select user details for display, so we will join.
            selectUsersColumns = true;
        } else if (role === UserRoleEnum.ADMIN) {
            // Admins see all activities for their store, but not those performed by managers.
            // This requires joining the users table and filtering.
            includeUsersTable = true;
            selectUsersColumns = true;
            conditions.push(
                eq(activityLog.userId, users.id), // Ensure the activity has a user for role filtering
                ne(users.role, UserRoleEnum.MANAGER), // Filter out managers
            );
        } else {
            // Any other role is forbidden from viewing activity logs.
            return handleError(
                res,
                "Forbidden: You do not have permission to view activity logs.",
                StatusCodeEnum.FORBIDDEN,
            );
        }

        // Build the Drizzle query dynamically based on flags
        let queryBuilder: any = db
            .select({
                activityLog, // Select all columns from activityLog
                store: {
                    // Always include store details if storeId is present
                    name: stores.name,
                },
                // Conditionally select user details
                user: selectUsersColumns
                    ? {
                          firstName: users.firstName,
                          lastName: users.lastName,
                          role: users.role, // Useful for debugging or future display
                      }
                    : {},
            })
            .from(activityLog)
            .leftJoin(stores, eq(activityLog.storeId, stores.id)); // Always join stores for store name

        // Conditionally apply leftJoin for users based on the flag
        if (includeUsersTable || selectUsersColumns) {
            // Join if we need to filter or select user columns
            queryBuilder = queryBuilder.leftJoin(
                users,
                eq(activityLog.userId, users.id),
            );
        }

        // Apply all built conditions
        const finalQuery = queryBuilder.where(
            and(...conditions.filter(Boolean)),
        ); // Filter out undefined conditions

        // Execute the query with ordering and pagination
        const activities = await finalQuery
            .orderBy(desc(activityLog.createdAt))
            .limit(limit)
            .offset(offset);

        // Get total count for pagination (important to run separately or use countDistinct)
        // The count query also needs to respect the same join and filter conditions
        let countQueryBuilder: any = db
            .select({ count: sql<number>`count(*)` })
            .from(activityLog);

        if (includeUsersTable || selectUsersColumns) {
            // Apply same conditional join for count
            countQueryBuilder = countQueryBuilder.leftJoin(
                users,
                eq(activityLog.userId, users.id),
            );
        }

        const finalCountQuery = countQueryBuilder.where(
            and(...conditions.filter(Boolean)),
        );
        const totalCountResult = await finalCountQuery;
        const totalCount = totalCountResult[0]?.count || 0;

        res.status(StatusCodeEnum.OK).json({
            data: activities,
            totalCount: totalCount,
            limit: limit,
            offset: offset,
        });
    } catch (error) {
        console.error("Failed to fetch activities:", error);
        handleError(
            res,
            "Failed to fetch activities due to an internal server error.",
            StatusCodeEnum.INTERNAL_SERVER_ERROR,
        );
    }
};
