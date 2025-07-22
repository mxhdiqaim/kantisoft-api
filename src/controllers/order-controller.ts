/* eslint-disable @typescript-eslint/no-explicit-any */
import { and, eq, gte, inArray, sum, count } from "drizzle-orm";
import { sql, desc } from "drizzle-orm";
import { lte } from "drizzle-orm/sql/expressions/conditions";
import { Request, Response } from "express";
import db from "../db";
import { menuItems } from "../schema/menu-items-schema";
import { orderItems, orders } from "../schema/orders-schema";
import { users } from "../schema/users-schema";
import { Period } from "../types";
import {
    OrderPaymentMethodEnum,
    OrderStatusEnum,
    StatusCodeEnum,
    UserRoleEnum,
} from "../types/enums";
import { handleError } from "../service/error-handling";
import { getPeriodDates } from "../utils/get-period-dates";
import { generateOrderReference } from "../utils";
import { logActivity } from "../service/activity-logger";

export const getAllOrders = async (req: Request, res: Response) => {
    try {
        const userStoreId = (req as any).userStoreId;
        const whereClause = userStoreId
            ? eq(orders.storeId, userStoreId)
            : undefined;

        const allOrders = await db.query.orders.findMany({
            where: whereClause,
            orderBy: [desc(orders.createdAt)],
            with: {
                store: { columns: { name: true } },
                seller: { columns: { firstName: true, lastName: true } },
                orderItems: {
                    with: {
                        menuItem: true,
                    },
                },
            },
        });
        res.status(StatusCodeEnum.OK).json(allOrders);
    } catch (error) {
        console.error(error);
        handleError(
            res,
            "Problem loading orders, please try again.",
            StatusCodeEnum.INTERNAL_SERVER_ERROR,
        );
    }
};

/**
 * @desc    Get orders by a dynamic period (day, week, month). Defaults to 'day'.
 * @route   GET /api/orders/by-period?period=week
 */
export const getOrdersByPeriod = async (req: Request, res: Response) => {
    try {
        const period = (req.query.period as Period) || "today";
        const timezone = "Africa/Lagos";
        const userStoreId = (req as any).userStoreId; // Get storeId from middleware

        const { startDate, endDate } = getPeriodDates(period, timezone);

        let whereClause =
            startDate && endDate
                ? and(
                      gte(orders.createdAt, startDate),
                      lte(orders.createdAt, endDate),
                  )
                : undefined;

        // If the user is an Admin, add their storeId to the where clause
        if (userStoreId) {
            const storeCondition = eq(orders.storeId, userStoreId);
            whereClause = whereClause
                ? and(whereClause, storeCondition)
                : storeCondition;
        }

        // Fetch all data in parallel
        const [ordersList, salesSummary, mostOrdered, topSellerResult] =
            await Promise.all([
                // Get the list of orders
                db.query.orders.findMany({
                    where: whereClause,
                    orderBy: (orders, { desc }) => [desc(orders.createdAt)],
                    with: {
                        seller: {
                            columns: { firstName: true, lastName: true },
                        },
                        orderItems: { with: { menuItem: true } },
                    },
                }),
                // Get total sales and order count
                db
                    .select({
                        totalRevenue: sum(orders.totalAmount),
                        totalOrders: count(orders.id),
                    })
                    .from(orders)
                    .where(whereClause),
                // Get the most ordered item
                db
                    .select({
                        name: menuItems.name,
                        quantity: sum(orderItems.quantity),
                    })
                    .from(orderItems)
                    .innerJoin(orders, eq(orderItems.orderId, orders.id))
                    .innerJoin(
                        menuItems,
                        eq(orderItems.menuItemId, menuItems.id),
                    )
                    .where(whereClause)
                    .groupBy(menuItems.name)
                    .orderBy(desc(sum(orderItems.quantity)))
                    .limit(1),
                //  Get the top seller by revenue
                db
                    .select({
                        sellerId: users.id,
                        firstName: users.firstName,
                        lastName: users.lastName,
                        totalRevenue: sum(orders.totalAmount),
                    })
                    .from(orders)
                    .innerJoin(users, eq(orders.sellerId, users.id))
                    .where(whereClause)
                    .groupBy(users.id, users.firstName, users.lastName)
                    .orderBy(desc(sum(orders.totalAmount)))
                    .limit(1),
            ]);

        const summary = salesSummary[0];
        const mostOrderedItem = mostOrdered[0];
        const topSeller = topSellerResult[0];

        const response = {
            period,
            totalRevenue: parseFloat(summary.totalRevenue || "0").toFixed(2),
            totalOrders: summary.totalOrders || 0,
            mostOrderedItem: mostOrderedItem
                ? {
                      name: mostOrderedItem.name,
                      quantity: parseInt(mostOrderedItem.quantity || "0"),
                  }
                : null,
            topSeller: topSeller
                ? {
                      name: `${topSeller.firstName} ${topSeller.lastName}`,
                      totalRevenue: parseFloat(
                          topSeller.totalRevenue || "0",
                      ).toFixed(2),
                  }
                : null,
            orders: ordersList,
        };

        return res.status(200).json(response);
    } catch (error) {
        console.error(error);
        return handleError(
            res,
            "Problem loading orders for the specified period, please try again.",
            StatusCodeEnum.INTERNAL_SERVER_ERROR,
        );
    }
};

export const getOrderById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userStoreId = (req as any).userStoreId;
        const isManager = req.user?.data.role === UserRoleEnum.MANAGER;

        let whereClause: any = eq(orders.id, id);

        if (!isManager && userStoreId) {
            whereClause = and(whereClause, eq(orders.storeId, userStoreId));
        }

        const order = await db.query.orders.findFirst({
            where: whereClause,
            with: {
                seller: {
                    columns: {
                        firstName: true,
                        lastName: true,
                    },
                },
                orderItems: {
                    with: {
                        menuItem: true,
                    },
                },
            },
        });

        if (!order) {
            return handleError(
                res,
                "The order is not found",
                StatusCodeEnum.NOT_FOUND,
            );
        }
        res.status(StatusCodeEnum.OK).json(order);
    } catch (error) {
        console.error(error);
        return handleError(
            res,
            "Problem loading order, please try again.",
            StatusCodeEnum.INTERNAL_SERVER_ERROR,
        );
    }
};

export const createOrder = async (req: Request, res: Response) => {
    // The request body should look like this:
    // {
    //   "sellerId": "some-uuid", (for the user taking the order)
    //   "paymentMethod": "paymentMethod",
    //   "orderStatus": "orderStatus",
    //   "items": [
    //     { "menuItemId": "uuid-for-burger", "quantity": 2 },
    //     { "menuItemId": "uuid-for-fries", "quantity": 1 }
    //   ]
    // }
    try {
        const {
            sellerId,
            storeId,
            items,
            paymentMethod = "cash" as OrderPaymentMethodEnum,
            orderStatus = "completed" as OrderStatusEnum,
        } = req.body;

        const user = req.user?.data;

        // Security check: Admins can only create orders for their own store
        if (user?.role === UserRoleEnum.ADMIN && storeId !== user.storeId) {
            return handleError(
                res,
                "You can only create orders for your assigned store.",
                StatusCodeEnum.FORBIDDEN,
            );
        }

        if (!items || !Array.isArray(items) || items.length === 0) {
            return handleError(
                res,
                "Order must contain at least one item.",
                StatusCodeEnum.BAD_REQUEST,
            );
        }
        if (!sellerId) {
            return handleError(
                res,
                "Seller is required.",
                StatusCodeEnum.BAD_REQUEST,
            );
        }

        if (!storeId) {
            return handleError(
                res,
                "Store is required",
                StatusCodeEnum.BAD_REQUEST,
            );
        }

        const menuItemIds: string[] = items.map((item) => item.menuItemId);

        // 1. Verify that all menu items exist and get their current prices
        const existingMenuItems = await db
            .select()
            .from(menuItems)
            .where(inArray(menuItems.id, menuItemIds));

        if (existingMenuItems.length !== menuItemIds.length) {
            return handleError(
                res,
                "One or more menu items not found.",
                StatusCodeEnum.NOT_FOUND,
            );
        }

        const priceMap = new Map(
            existingMenuItems.map((item) => [item.id, item.price]),
        );

        // 2. Calculate total price
        let totalAmount = 0;
        const orderItemsToInsert = items.map((item) => {
            const priceString = priceMap.get(item.menuItemId);
            if (priceString === undefined) {
                throw new Error(
                    `Could not find price for menu item ${item.menuItemId}`,
                );
            }

            const priceAtOrder = parseFloat(priceString);
            const subTotal = priceAtOrder * item.quantity;
            totalAmount += subTotal;
            return {
                menuItemId: item.menuItemId,
                quantity: String(item.quantity),
                priceAtOrder: priceAtOrder,
                subTotal: subTotal,
            };
        });

        // 3. Create the order and the order items within a transaction
        const newOrder = await db.transaction(async (tx) => {
            const orderReference = generateOrderReference();

            const [insertedOrder] = await tx
                .insert(orders)
                .values({
                    reference: orderReference,
                    totalAmount,
                    paymentMethod,
                    orderStatus,
                    sellerId,
                    storeId,
                })
                .returning({ reference: orders.reference, id: orders.id });

            // Log this activity after the transaction is successful
            await logActivity({
                userId: sellerId,
                storeId: storeId,
                action: "ORDER_CREATED",
                entityId: insertedOrder.id,
                entityType: "order",
                details: `User created a new order with reference ${insertedOrder.reference}.`,
            });

            // Insert into the 'orderItems' table
            const newOrderItemsData = orderItemsToInsert.map((item) => ({
                ...item,
                orderId: insertedOrder.id, // <-- Use the returned ID
            }));
            await tx.insert(orderItems).values(newOrderItemsData);

            // 4. Fetch and return the complete order data
            return await tx.query.orders.findFirst({
                where: eq(orders.id, insertedOrder.id),
                with: {
                    orderItems: {
                        with: {
                            menuItem: true,
                        },
                    },
                    seller: {
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
        });

        res.status(StatusCodeEnum.CREATED).json(newOrder);
    } catch (error) {
        console.error(error);
        return handleError(
            res,
            "Problem creating order, please try again",
            StatusCodeEnum.INTERNAL_SERVER_ERROR,
        );
    }
};

// Note: Updating and deleting orders might have complex business rules
// (e.g. can't update an order that's already being prepared).
// For now, these are simple implementations.

// Update an order's status
export const updateOrderStatus = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { orderStatus } = req.body; // e.g. 'pending', 'completed', 'cancelled'
        const userStoreId = (req as any).userStoreId;
        const isManager = req.user?.data.role === UserRoleEnum.MANAGER;

        if (!orderStatus) {
            return handleError(
                res,
                "Order status is required.",
                StatusCodeEnum.BAD_REQUEST,
            );
        }

        let whereClause: any = eq(orders.id, id);
        if (!isManager && userStoreId) {
            whereClause = and(whereClause, eq(orders.storeId, userStoreId));
        }

        // Add the condition that the order must be 'pending' to be updated
        const finalWhereClause = and(
            whereClause,
            eq(orders.orderStatus, OrderStatusEnum.PENDING),
        );

        const updatedOrder = await db
            .update(orders)
            .set({ orderStatus })
            .where(finalWhereClause)
            .returning();

        if (updatedOrder.length === 0) {
            return handleError(
                res,
                "The order is not found or or it cannot be updated because it is completed or cancelled.",
                StatusCodeEnum.NOT_FOUND,
            );
        }

        res.status(StatusCodeEnum.OK).json(updatedOrder[0]);
    } catch (error) {
        console.error(error);
        handleError(
            res,
            "Problem updating order, please try again.",
            StatusCodeEnum.INTERNAL_SERVER_ERROR,
        );
    }
};

// Delete an order
export const deleteOrder = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userStoreId = (req as any).userStoreId;
        const isManager = req.user?.data.role === UserRoleEnum.MANAGER;

        let whereClause: any = eq(orders.id, id);
        if (!isManager && userStoreId) {
            whereClause = and(whereClause, eq(orders.storeId, userStoreId));
        }

        // Add the condition that the order must be 'pending' to be deleted
        const finalWhereClause = and(
            whereClause,
            eq(orders.orderStatus, OrderStatusEnum.PENDING),
        );

        // The 'onDelete: cascade' in the schema will automatically delete related orderItems.
        const deletedOrder = await db
            .delete(orders)
            .where(finalWhereClause)
            .returning();

        if (deletedOrder.length === 0) {
            return handleError(
                res,
                "The order is not found or it cannot be deleted because it is already completed or cancelled.",
                StatusCodeEnum.NOT_FOUND,
            );
        }
        res.status(StatusCodeEnum.OK).json({
            message: "Order deleted successfully",
        });
    } catch (error) {
        console.error(error);
        return handleError(
            res,
            "Problem deleting order, please try again.",
            StatusCodeEnum.INTERNAL_SERVER_ERROR,
        );
    }
};

// Get the most ordered item
export const getMostOrderedItem = async (req: Request, res: Response) => {
    try {
        const userStoreId = (req as any).userStoreId;
        const whereClause = userStoreId
            ? eq(orders.storeId, userStoreId)
            : undefined;

        // Aggregate total quantity for each menu item
        const result = await db
            .select({
                menuItemId: orderItems.menuItemId,
                totalQuantity: sql<number>`SUM(${orderItems.quantity})`.as(
                    "totalQuantity",
                ),
            })
            .from(orderItems)
            .where(whereClause)
            .groupBy(orderItems.menuItemId)
            .orderBy(desc(sql`totalQuantity`))
            .limit(1);

        if (result.length === 0) {
            return handleError(
                res,
                "No orders found.",
                StatusCodeEnum.NOT_FOUND,
            );
        }

        // Fetch menu item details
        const menuItem = await db.query.menuItems.findFirst({
            where: (menuItems, { eq }) =>
                eq(menuItems.id, result[0].menuItemId),
        });

        res.status(StatusCodeEnum.OK).json({
            menuItem,
            totalQuantity: result[0].totalQuantity,
        });
    } catch (error) {
        console.error(error);
        handleError(
            res,
            "Problem fetching most ordered item, please try again.",
            StatusCodeEnum.INTERNAL_SERVER_ERROR,
        );
    }
};

/**
 * @desc    Get a single order by its reference
 * @route   GET /api/orders/reference/:reference
 * @access  Private
 */
export const getOrderByReference = async (req: Request, res: Response) => {
    try {
        const { reference } = req.params;
        const userStoreId = (req as any).userStoreId;
        const isManager = req.user?.data.role === UserRoleEnum.MANAGER;

        let whereClause: any = eq(orders.reference, reference);

        if (!isManager && userStoreId) {
            whereClause = and(whereClause, eq(orders.storeId, userStoreId));
        }

        const order = await db.query.orders.findFirst({
            where: whereClause,
            with: {
                seller: {
                    columns: {
                        firstName: true,
                        lastName: true,
                    },
                },
                orderItems: {
                    with: {
                        menuItem: true,
                    },
                },
            },
        });

        if (!order) {
            return handleError(
                res,
                "The order is not found",
                StatusCodeEnum.NOT_FOUND,
            );
        }
        res.status(StatusCodeEnum.OK).json(order);
    } catch (error) {
        console.error(error);
        return handleError(
            res,
            "Problem loading order, please try again.",
            StatusCodeEnum.INTERNAL_SERVER_ERROR,
        );
    }
};
