import { and, eq, gte, inArray, sum, count } from "drizzle-orm";
import { sql, desc } from "drizzle-orm";
import { lte } from "drizzle-orm/sql/expressions/conditions";
import { Response } from "express";
import db from "../db";
import { menuItems } from "../schema/menu-items-schema";
import { orderItems, orders } from "../schema/orders-schema";
import { users } from "../schema/users-schema";
import {
    OrderPaymentMethodEnum,
    OrderStatusEnum,
    StatusCodeEnum,
} from "../types/enums";
import { handleError, handleError2 } from "../service/error-handling";
import { generateOrderReference } from "../utils";
import { logActivity } from "../service/activity-logger";
import { CustomRequest } from "../types/express";
import { decrementStockForOrder } from "./inventory-controller";
import { StatusCodes } from "http-status-codes";
import { validateStoreAndExtractDates } from "../utils/validate-store-dates";

export const getAllOrders = async (req: CustomRequest, res: Response) => {
    try {
        const userStoreId = req.userStoreId;
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
 * @desc    Get orders by a dynamic period (today, week, month). Defaults to 'today'.
 * @route   GET /api/v1/orders/by-period?period=week
 *
 * @queryParam timePeriod string ('today', 'week', 'month', 'all-time')
 * @queryParam startDate string (DD/MM/YYYY format for custom range)
 * @queryParam endDate string (DD/MM/YYYY format for custom range)
 * @queryParam timezone string (e.g. 'Africa/Lagos')
 */
export const getOrdersByPeriod = async (req: CustomRequest, res: Response) => {
    try {
        const validated = await validateStoreAndExtractDates(req, res);
        if (!validated) return;

        const { storeIds, finalStartDate: startDate, finalEndDate: endDate, periodUsed, storeQueryType } = validated;

        let whereClause =
            startDate && endDate
                ? and(
                      gte(orders.createdAt, startDate),
                      lte(orders.createdAt, endDate),
                  )
                : undefined;

        // If the user is an Admin, add their storeId to the where clause
        if (storeIds) {
            const storeCondition = inArray(orders.storeId, storeIds);
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
            timePeriod: periodUsed,
            startDate: startDate ? startDate.toISOString() : 'All Time',
            endDate: endDate ? endDate.toISOString() : 'All Time',
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
            storeQueryType
        };

        return res.status(StatusCodes.OK).json(response);
    } catch (error) {
        console.error(error);
        return handleError2(
            res,
            "Problem loading orders for the specified period, please try again.",
            StatusCodes.INTERNAL_SERVER_ERROR,
            error instanceof Error ? error : undefined,
        );
    }
};

export const getOrderById = async (req: CustomRequest, res: Response) => {
    try {
        const { id } = req.params;
        // const userStoreId = req.userStoreId;
        const userStoreId = req.userStoreId;
        // const isManager = req.user?.data.role === UserRoleEnum.MANAGER;

        if (!userStoreId) {
            return handleError(
                res,
                "User not associated with a store.",
                StatusCodeEnum.UNAUTHORIZED,
            );
        }

        // CRITICAL FIX: Always filter by the user's storeId.
        // A manager should only see orders from their own store.
        const whereClause = and(
            eq(orders.id, id),
            eq(orders.storeId, userStoreId),
        );

        // if (!isManager && userStoreId) {
        //     whereClause = and(whereClause, eq(orders.storeId, userStoreId));
        // }

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

/*
    * @desc    Create a new order
    * @route   POST /api/orders
    * @access  Private (Seller/Manager/Admin of the same store)
    * @body    { "sellerId": "some-uuid", "paymentMethod": "paymentMethod", "orderStatus": "orderStatus", "items": [ { "menuItemId": "uuid-for-burger", "quantity": 2 }, { "menuItemId": "uuid-for-fries", "quantity": 1 }] }
 */

export const createOrder = async (req: CustomRequest, res: Response) => {
    try {
        const {
            sellerId,
            items,
            paymentMethod = "cash" as OrderPaymentMethodEnum,
            orderStatus = "completed" as OrderStatusEnum,
        } = req.body;

        const currentUser = req.user?.data;
        const storeId = currentUser?.storeId;

        // CRITICAL FIX: Don't trust the storeId from the request body.
        // Get the storeId directly from the authenticated user.
        if (!storeId) {
            return handleError2(
                res,
                "User is not associated with a store.",
                StatusCodes.FORBIDDEN,
            );
        }

        if (!sellerId) {
            return handleError2(
                res,
                "Seller is required.",
                StatusCodes.BAD_REQUEST,
            );
        }

        // CRITICAL FIX: Validate that the sellerId belongs to the same store
        const sellerUser = await db.query.users.findFirst({
            where: and(eq(users.id, sellerId), eq(users.storeId, storeId)),
        });

        if (!sellerUser) {
            return handleError2(
                res,
                "The specified seller does not belong to the store.",
                StatusCodes.FORBIDDEN,
            );
        }

        if (!items || !Array.isArray(items) || items.length === 0) {
            return handleError2(
                res,
                "Order must contain at least one item.",
                StatusCodes.BAD_REQUEST,
            );
        }

        const menuItemIds: string[] = items.map((item) => item.menuItemId);

        // Verify that all menu items exist and get their current prices
        const existingMenuItems = await db
            .select()
            .from(menuItems)
            .where(inArray(menuItems.id, menuItemIds));

        if (existingMenuItems.length !== menuItemIds.length) {
            return handleError2(
                res,
                "One or more menu items not found.",
                StatusCodes.NOT_FOUND,
            );
        }

        const priceMap = new Map(
            existingMenuItems.map((item) => [item.id, item.price]),
        );

        // Calculate total price
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

        // Create the order and the order items within a transaction
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

            // Insert into the 'orderItems' table
            const newOrderItemsData = orderItemsToInsert.map((item) => ({
                ...item,
                orderId: insertedOrder.id, // <-- Use the returned ID
            }));
            await tx.insert(orderItems).values(newOrderItemsData);

            // 3. CRITICAL: DECREMENT STOCK
            // This must run within the transaction (tx) so that if stock is not enough,
            // the entire order (step 1 & 2) is automatically rolled back.
            const itemsForStockDecrement = items.map(item => ({
                menuItemId: item.menuItemId,
                quantity: Number(item.quantity),
                priceAtOrder: parseFloat(priceMap.get(item.menuItemId) as string)
            }));

            await decrementStockForOrder(
                insertedOrder.id,
                itemsForStockDecrement,
                sellerId,
                storeId,
                tx,
            );

            // Log this activity after the transaction is successful
            await logActivity({
                userId: sellerId,
                storeId: storeId,
                action: "ORDER_CREATED",
                entityId: insertedOrder.id,
                entityType: "order",
                details: `User created a new order with reference ${insertedOrder.reference}.`,
            });

            //  Fetch and return the complete order data
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

        res.status(StatusCodes.CREATED).json(newOrder);
    } catch (error) {
        // console.error(error);
        return handleError2(
            res,
            "Problem creating order, please try again",
            StatusCodes.INTERNAL_SERVER_ERROR,
            error instanceof Error ? error : undefined,
        );
    }
};

/**
 * @desc    Update an order's status
 * @route   PATCH /orders/:id
 * @access  Private (Manager/Admin of the same store)
 */
export const updateOrderStatus = async (req: CustomRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { orderStatus } = req.body; // e.g. 'pending', 'completed', 'cancelled'
        // const userStoreId = req.userStoreId;
        const userStoreId = req.userStoreId;
        // const isManager = req.user?.data.role === UserRoleEnum.MANAGER;

        if (!userStoreId) {
            return handleError(
                res,
                "User not associated with a store.",
                StatusCodeEnum.UNAUTHORIZED,
            );
        }

        if (!orderItems) {
            return handleError(
                res,
                "Order status is required.",
                StatusCodeEnum.BAD_REQUEST,
            );
        }

        if (!orderStatus) {
            return handleError(
                res,
                "Order status is required.",
                StatusCodeEnum.BAD_REQUEST,
            );
        }

        // Add the condition that the order must be 'pending' to be updated
        const whereClause = and(
            eq(orders.id, id),
            eq(orders.storeId, userStoreId),
            eq(orders.orderStatus, OrderStatusEnum.PENDING),
        );

        const updatedOrder = await db
            .update(orders)
            .set({ orderStatus })
            .where(whereClause)
            .returning();

        if (updatedOrder.length === 0) {
            return handleError(
                res,
                "The order is not found or or it cannot be updated because it is completed or cancelled.",
                StatusCodeEnum.NOT_FOUND,
            );
        }

        // Log activity for order status update
        await logActivity({
            userId: req.user?.data.id,
            storeId: userStoreId,
            action: "ORDER_STATUS_UPDATED",
            entityId: updatedOrder[0].id,
            entityType: "order",
            details: `Order status updated to "${orderStatus}" by ${req.user?.data.firstName} ${req.user?.data.lastName}.`,
        });

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
export const deleteOrder = async (req: CustomRequest, res: Response) => {
    try {
        const { id } = req.params;
        const userStoreId = req.userStoreId;

        if (!userStoreId) {
            return handleError(
                res,
                "User not associated with a store.",
                StatusCodeEnum.UNAUTHORIZED,
            );
        }

        // Add the condition that the order must be 'pending' to be deleted
        const whereClause = and(
            eq(orders.id, id),
            eq(orders.storeId, userStoreId),
            eq(orders.orderStatus, OrderStatusEnum.PENDING), // Your existing logic is great here
        );

        // The 'onDelete: cascade' in the schema will automatically delete related orderItems.
        const deletedOrder = await db
            .delete(orders)
            .where(whereClause)
            .returning();

        if (deletedOrder.length === 0) {
            return handleError(
                res,
                "The order is not found or it cannot be deleted because it is already completed or cancelled.",
                StatusCodeEnum.NOT_FOUND,
            );
        }

        // Log activity for order deletion
        await logActivity({
            userId: req.user?.data.id,
            storeId: userStoreId,
            action: "ORDER_DELETED",
            entityId: deletedOrder[0].id,
            entityType: "order",
            details: `Order with reference ${deletedOrder[0].reference} deleted by ${req.user?.data.firstName} ${req.user?.data.lastName}.`,
        });

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
export const getMostOrderedItem = async (req: CustomRequest, res: Response) => {
    try {
        const userStoreId = req.userStoreId;
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
export const getOrderByReference = async (
    req: CustomRequest,
    res: Response,
) => {
    try {
        const { reference } = req.params;
        const userStoreId = req.userStoreId;
        // const userStoreId = req.userStoreId;
        // const isManager = req.user?.data.role === UserRoleEnum.MANAGER;

        if (!userStoreId) {
            return handleError(
                res,
                "User not associated with a store.",
                StatusCodeEnum.UNAUTHORIZED,
            );
        }

        // CRITICAL FIX: The where clause must ALWAYS filter by the storeId
        const whereClause = and(
            eq(orders.reference, reference),
            eq(orders.storeId, userStoreId),
        );

        // if (!isManager && userStoreId) {
        //     whereClause = and(whereClause, eq(orders.storeId, userStoreId));
        // }

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
