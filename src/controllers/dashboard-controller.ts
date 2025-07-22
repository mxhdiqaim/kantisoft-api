/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from "express";
import db from "../db";
import { sql, sum, count, desc, gte, lt, and, eq, min, max } from "drizzle-orm";
import { getPeriodDates } from "../utils/get-period-dates";
import { orderItems, orders } from "../schema/orders-schema";
import { handleError } from "../service/error-handling";
import { StatusCodeEnum } from "../types/enums";
import { OrderBy, Period } from "../types";
import { menuItems } from "../schema/menu-items-schema";
import moment from "moment-timezone";

/**
 * @description Get core sales summary metrics (Revenue, Order Count, Avg Order Value)
 * @route GET /api/dashboard/sales-summary
 * @access Private (Admin/Manager)
 * @queryParam period string ('today', 'week', 'month', 'all-time')
 * @queryParam timezone string (e.g., 'Africa/Lagos') - defaults if not provided
 */
export const getSalesSummary = async (req: Request, res: Response) => {
    const period = (req.query.period as Period) || "today";
    const timezone = "Africa/Lagos";
    const userStoreId = (req as any).userStoreId; // Get storeId from middleware

    try {
        const { startDate, endDate } = getPeriodDates(
            period as Period,
            timezone,
        );

        let whereClause =
            startDate && endDate
                ? and(
                      gte(orders.orderDate, startDate),
                      lt(orders.orderDate, endDate),
                  )
                : undefined;
        // If the user is an Admin, add their storeId to the where clause
        if (userStoreId) {
            const storeCondition = eq(orders.storeId, userStoreId);
            whereClause = whereClause
                ? and(whereClause, storeCondition)
                : storeCondition;
        }

        const result = await db
            .select({
                totalRevenue: sum(orders.totalAmount),
                totalOrders: count(orders.id),
                avgOrderValue: sql<number>`AVG(${orders.totalAmount})`,
            })
            .from(orders)
            .where(whereClause);

        const summary = result[0];

        res.status(200).json({
            period,
            totalRevenue: parseFloat(summary.totalRevenue || "0").toFixed(2),
            totalOrders: parseInt(String(summary.totalOrders || "0")),
            avgOrderValue: parseFloat(
                String(summary.avgOrderValue ?? "0"),
            ).toFixed(2),
        });
    } catch (error) {
        console.error(
            `Error fetching sales summary for period ${period}:`,
            error,
        );
        return handleError(
            res,
            `Failed to retrieve sales summary for ${period}.`,
            StatusCodeEnum.INTERNAL_SERVER_ERROR,
        );
    }
};

/**
 * @description Get top N selling items by quantity or revenue
 * @route GET /api/dashboard/top-sells
 * @access Private (Admin/Manager)
 * @queryParam limit number (default 5)
 * @queryParam orderBy string ('quantity', 'revenue') (default 'quantity')
 * @queryParam period string ('today', 'week', 'month', 'all-time')
 * @queryParam timezone string (e.g., 'Africa/Lagos')
 */
export const getTopSells = async (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 5;
    const orderBy = (req.query.orderBy as OrderBy) || "quantity"; // 'quantity' or 'revenue'
    const period = (req.query.period as Period) || "month";
    const timezone = "Africa/Lagos";
    const userStoreId = (req as any).userStoreId; // Get storeId from middleware

    try {
        const { startDate, endDate } = getPeriodDates(
            period as Period,
            timezone,
        );

        let whereClause =
            startDate && endDate
                ? and(
                      gte(orders.orderDate, startDate),
                      lt(orders.orderDate, endDate),
                  )
                : undefined;

        // If the user is an Admin, add their storeId to the where clause
        if (userStoreId) {
            const storeCondition = eq(orders.storeId, userStoreId);
            whereClause = whereClause
                ? and(whereClause, storeCondition)
                : storeCondition;
        }

        const topItemsQuery = db
            .select({
                itemId: orderItems.menuItemId,
                itemName: menuItems.name,
                totalQuantitySold: sum(orderItems.quantity).as(
                    "totalQuantitySold",
                ),
                totalRevenueGenerated: sum(
                    sql`${orderItems.quantity} * ${orderItems.priceAtOrder}`,
                ).as("totalRevenueGenerated"),
            })
            .from(orderItems)
            .innerJoin(menuItems, eq(orderItems.menuItemId, menuItems.id))
            .innerJoin(orders, eq(orderItems.orderId, orders.id))
            .where(whereClause)
            .groupBy(orderItems.menuItemId, menuItems.name);

        let orderedQuery;
        if (orderBy === "revenue") {
            orderedQuery = topItemsQuery.orderBy(
                desc(
                    sum(
                        sql`${orderItems.quantity} * ${orderItems.priceAtOrder}`,
                    ),
                ),
            );
        } else {
            orderedQuery = topItemsQuery.orderBy(
                desc(sum(orderItems.quantity)),
            );
        }

        const topItems = await orderedQuery.limit(limit);

        res.status(200).json(
            topItems.map((m) => ({
                ...m,
                totalQuantitySold: parseFloat(m.totalQuantitySold || "0"),
                totalRevenueGenerated: parseFloat(
                    m.totalRevenueGenerated || "0",
                ).toFixed(2),
            })),
        );
    } catch (error) {
        console.error(
            `Error fetching top products for period ${period}:`,
            error,
        );
        return handleError(
            res,
            `Failed to retrieve top products for ${period}.`,
            StatusCodeEnum.INTERNAL_SERVER_ERROR,
        );
    }
};

/**
 * @description Get inventory summary metrics (low stock, out of stock counts)
 * @route GET /api/dashboard/inventory-summary
 * @access Private (Admin/Manager) - Only relevant for supermarket/pharmacy
 */
export const getInventorySummary = async (req: Request, res: Response) => {
    try {
        const userStoreId = (req as any).userStoreId; // Get storeId from middleware
        const whereClause = userStoreId
            ? eq(menuItems.storeId, userStoreId)
            : undefined;

        const lowStockItems = await db
            .select({
                id: menuItems.id,
                name: menuItems.name,
                isAvailable: menuItems.isAvailable,
                //   currentStock: products.currentStock,
                //   minStockLevel: products.minStockLevel,
            })
            .from(menuItems)
            .where(and(whereClause, sql`${!menuItems.isAvailable}`));

        const outOfStockItems = await db
            .select({
                id: menuItems.id,
                name: menuItems.name,
            })
            .from(menuItems)
            .where(and(whereClause, eq(menuItems.isAvailable, false)));

        res.status(200).json({
            totalLowStockItems: lowStockItems.length,
            totalOutOfStockItems: outOfStockItems.length,
            // lowStockDetails: lowStockItems.filter(item => item.currentStock > 0), // Items that are low but not zero
            outOfStockDetails: outOfStockItems,
        });
    } catch (error) {
        console.error("Error fetching inventory summary:", error);
        return handleError(
            res,
            "Failed to retrieve inventory summary.",
            StatusCodeEnum.INTERNAL_SERVER_ERROR,
        );
    }
};

/**
 * @description Get sales trend by day for a given period
 * @route GET /api/dashboard/sales-trend
 * @access Private (Admin/Manager)
 * @queryParam period string ('week', 'month')
 * @queryParam timezone string (e.g., 'Africa/Lagos')
 */
export const getSalesTrend = async (req: Request, res: Response) => {
    const period = (req.query.period as Period) || "week"; // 'week' or 'month'
    const timezone = "Africa/Lagos";
    const userStoreId = (req as any).userStoreId; // Get storeId from middleware

    try {
        // Handle 'all-time' period by grouping by month
        if (period === "all-time") {
            const salesTrendByMonth = await db
                .select({
                    date: sql<string>`TO_CHAR(${orders.orderDate}, 'YYYY-MM')`,
                    monthlyRevenue: sum(orders.totalAmount),
                    monthlyOrders: count(orders.id),
                })
                .from(orders)
                .where(
                    userStoreId ? eq(orders.storeId, userStoreId) : undefined,
                ) // Scope the query
                .groupBy(sql`TO_CHAR(${orders.orderDate}, 'YYYY-MM')`)
                .orderBy(sql`TO_CHAR(${orders.orderDate}, 'YYYY-MM')`);

            const dateRange = await db
                .select({
                    minDate: min(orders.orderDate),
                    maxDate: max(orders.orderDate),
                })
                .from(orders)
                .where(
                    userStoreId ? eq(orders.storeId, userStoreId) : undefined,
                ); // Scope the query

            const firstOrderDate = dateRange[0].minDate;
            const lastOrderDate = dateRange[0].maxDate;

            if (!firstOrderDate || !lastOrderDate) {
                return res.status(200).json([]); // No data to show
            }

            const allMonths = [];
            const current = moment(firstOrderDate)
                .tz(timezone)
                .startOf("month");
            const end = moment(lastOrderDate).tz(timezone).startOf("month");

            while (current.isSameOrBefore(end, "month")) {
                allMonths.push(current.format("YYYY-MM"));
                current.add(1, "month");
            }

            const salesMap = new Map(
                salesTrendByMonth.map((s) => [
                    s.date,
                    {
                        revenue: parseFloat(s.monthlyRevenue || "0"),
                        orders: parseInt(String(s.monthlyOrders || "0")),
                    },
                ]),
            );

            const formattedTrend = allMonths.map((date) => ({
                date,
                dailyRevenue: salesMap.get(date)?.revenue || 0,
                dailyOrders: salesMap.get(date)?.orders || 0,
            }));

            return res.status(200).json(formattedTrend);
        }

        const { startDate, endDate } = getPeriodDates(period, timezone);

        if (!startDate || !endDate) {
            return handleError(
                res,
                `Invalid period specified for sales trend: ${period}`,
                StatusCodeEnum.BAD_REQUEST,
            );
        }
        const baseWhere =
            startDate && endDate
                ? and(
                      gte(orders.orderDate, startDate),
                      lt(orders.orderDate, endDate),
                  )
                : undefined;

        const whereClause = userStoreId
            ? and(baseWhere, eq(orders.storeId, userStoreId))
            : baseWhere;

        // Group by day using PostgreSQL's TO_CHAR for formatting date
        const salesTrend = await db
            .select({
                date: sql<string>`TO_CHAR(${orders.orderDate}, 'YYYY-MM-DD') AS date`,
                dailyRevenue: sum(orders.totalAmount).as("dailyRevenue"),
                dailyOrders: count(orders.id).as("dailyOrders"),
            })
            .from(orders)
            .where(whereClause)
            .groupBy(sql`TO_CHAR(${orders.orderDate}, 'YYYY-MM-DD')`)
            .orderBy(sql`date`);

        // Fill in missing dates with zero sales for a complete trend line
        const allDates = [];
        const current = moment(startDate).tz(timezone).startOf("day");
        const end = moment(endDate).tz(timezone).startOf("day");

        while (current.isSameOrBefore(end, "day")) {
            allDates.push(current.format("YYYY-MM-DD"));
            current.add(1, "day");
        }

        const salesMap = new Map(
            salesTrend.map((s) => [
                s.date,
                {
                    dailyRevenue: parseFloat(s.dailyRevenue || "0"),
                    dailyOrders: parseInt(String(s.dailyOrders || "0")),
                },
            ]),
        );

        const formattedTrend = allDates.map((date) => ({
            date,
            dailyRevenue: salesMap.get(date)?.dailyRevenue || 0,
            dailyOrders: salesMap.get(date)?.dailyOrders || 0,
        }));

        res.status(200).json(formattedTrend);
    } catch (error) {
        console.error(
            `Error fetching sales trend for period ${period}: ${error}`,
        );
        return handleError(
            res,
            `Failed to retrieve sales trend for ${period}.`,
            StatusCodeEnum.INTERNAL_SERVER_ERROR,
        );
    }
};
