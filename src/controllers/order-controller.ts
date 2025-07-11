import {lte} from "drizzle-orm/sql/expressions/conditions";
import { Request, Response } from 'express';
import db from '../db';
import { orders } from '../schema/orders-schema';
import { orderItems } from '../schema/orders-schema';
import { menuItems } from '../schema/menu-items-schema';
import {and, eq, gte, inArray} from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import {OrderPeriod} from "../types";

// Get all orders with their items
export const getAllOrders = async (req: Request, res: Response) => {
    try {
        const allOrders = await db.query.orders.findMany({
            with: {
                orderItems: {
                    with: {
                        menuItem: true,
                    },
                },
            },
        });
        res.status(200).json(allOrders);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Problem loading orders, please try again.' });
    }
};

/**
 * @desc    Get orders by a dynamic period (day, week, month). Defaults to 'day'.
 * @route   GET /api/orders/by-period?period=week
 */

export const getOrdersByPeriod = async (req: Request, res: Response) => {
    try {
        // Determine the period, defaulting to 'day'.
        const period = (req.query.period as OrderPeriod) || 'day';

        if (!['day', 'week', 'month'].includes(period)) {
            return res.status(400).json({ message: "Invalid period. Use 'day', 'week', or 'month'." });
        }

        // Calculate the start and end dates for the database query.
        // Note: This logic uses the server's local timezone.
        const now = new Date();
        let startDate: Date;
        let endDate: Date;

        const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, 2 = Tuesday etc.

        switch (period) {
            case 'month':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                startDate.setHours(0, 0, 0, 0);

                endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0); // Last day of the current month
                endDate.setHours(23, 59, 59, 999);
                break;

            case 'week':
                startDate = new Date(now.setDate(now.getDate() - dayOfWeek));
                startDate.setHours(0, 0, 0, 0);

                endDate = new Date(startDate);
                endDate.setDate(startDate.getDate() + 6);
                endDate.setHours(23, 59, 59, 999);
                break;

            case 'day':
            default:
                startDate = new Date();
                startDate.setHours(0, 0, 0, 0);

                endDate = new Date();
                endDate.setHours(23, 59, 59, 999);
                break;
        }

        // 3. Query the database for orders within the calculated date range.
        const result = await db.query.orders.findMany({
            where: and(
                gte(orders.createdAt, startDate),
                lte(orders.createdAt, endDate)
            ),
            orderBy: (orders, { desc }) => [desc(orders.createdAt)],
            // Fetch related order items and their menu item details for a complete response
            with: {
                orderItems: {
                    with: {
                        menuItem: true,
                    },
                },
            },
        });

        return res.status(200).json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Problem loading today's orders, please try again." });
    }
};

// Get a single order by ID with its items
export const getOrderById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const order = await db.query.orders.findFirst({
            where: eq(orders.id, id),
            with: {
                orderItems: {
                    with: {
                        menuItem: true,
                    },
                },
            },
        });

        if (!order) {
            return res.status(404).json({ message: 'The order is not found' });
        }
        res.status(200).json(order);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Problem loading order, please try again.' });
    }
};

// Create a new order
export const createOrder = async (req: Request, res: Response) => {
    // The request body should look like this:
    // {
    //   "sellerId": "some-uuid", (for the user taking the order)
    //   "items": [
    //     { "menuItemId": "uuid-for-burger", "quantity": 2 },
    //     { "menuItemId": "uuid-for-fries", "quantity": 1 }
    //   ]
    // }
    try {
        const { sellerId, items } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ message: 'Order must contain at least one item.' });
        }
        if(!sellerId) {
            return res.status(400).json({ message: 'sellerId is required.' });
        }

        const menuItemIds: string[] = items.map(item => item.menuItemId);

        // 1. Verify that all menu items exist and get their current prices
        const existingMenuItems = await db.select().from(menuItems).where(inArray(menuItems.id, menuItemIds));
        if (existingMenuItems.length !== menuItemIds.length) {
            return res.status(400).json({ message: 'One or more menu items not found.' });
        }

        const priceMap = new Map(existingMenuItems.map(item => [item.id, item.price]));

        // 2. Calculate total price
        let totalAmount = 0;
        const orderItemsToInsert = items.map(item => {
            const priceAtOrder = priceMap.get(item.menuItemId);
            if(priceAtOrder === undefined) {
                throw new Error(`Could not find price for menu item ${item.menuItemId}`);
            }
            totalAmount += priceAtOrder * item.quantity;
            return {
                menuItemId: item.menuItemId,
                quantity: item.quantity,
                priceAtOrder: priceAtOrder,
            };
        });

        // 3. Create the order and the order items within a transaction
        const newOrder = await db.transaction(async (tx) => {
            const newOrderId = uuidv4();

            // Insert into the parent 'orders' table
            await tx.insert(orders).values({
                id: newOrderId,
                sellerId,
                totalAmount,
            });

            // Insert into the 'orderItems' table
            const newOrderItemsData = orderItemsToInsert.map(item => ({
                ...item,
                orderId: newOrderId,
            }));
            await tx.insert(orderItems).values(newOrderItemsData);

            // 4. Fetch and return the complete order data
            return await tx.query.orders.findFirst({
                where: eq(orders.id, newOrderId),
                with: {
                    orderItems: {
                        with: {
                            menuItem: true,
                        },
                    },
                },
            });
        });

        res.status(201).json(newOrder);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Problem creating order, please try again.' });
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

        if (!orderStatus) {
            return res.status(400).json({ message: 'Order status is required.' });
        }

        const updatedOrder = await db.update(orders)
            .set({ orderStatus })
            .where(eq(orders.id, id))
            .returning();

        if (updatedOrder.length === 0) {
            return res.status(404).json({ message: 'The order is not found' });
        }

        res.status(200).json(updatedOrder[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Problem updating order, please try again.' });
    }
};

// Delete an order
export const deleteOrder = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        // The 'onDelete: cascade' in the schema will automatically delete related orderItems.
        const deletedOrder = await db.delete(orders).where(eq(orders.id, id)).returning();

        if (deletedOrder.length === 0) {
            return res.status(404).json({ message: 'The order is not found' });
        }
        res.status(200).json({ message: 'Order deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Problem deleting order, please try again.' });
    }
};
