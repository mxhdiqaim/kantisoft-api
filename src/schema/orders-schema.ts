import {doublePrecision, pgEnum, pgTable, timestamp, uuid} from "drizzle-orm/pg-core";
import {menuItems} from "./menu-items-schema";
import {users} from "./users-schema";

export const orderStatusEnum = pgEnum("orderStatus", [
    "cancelled",
    "completed",
    "pending",
]);

export const orderPaymentMethodEnum = pgEnum("paymentMethod", [
    "card",
    "cash",
    "transfer",
]);

export const orders = pgTable('orders', {
    id: uuid('id').defaultRandom().primaryKey(),
    totalAmount: doublePrecision('totalAmount').notNull(),
    paymentMethod: orderPaymentMethodEnum('paymentMethod').notNull().default("cash"), // 'cash', 'card' or 'transfer'
    orderDate: timestamp('orderDate').defaultNow().notNull(),
    orderStatus: orderStatusEnum('orderStatus').notNull().default('completed'), // 'cancelled', 'completed' or 'pending'
    sellerId: uuid('sellerId').references(() => users.id).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    lastModified: timestamp("lastModified")
        .defaultNow()
        .notNull()
        .$onUpdateFn(() => new Date()),
});

export type OrderSchemaT = typeof orders.$inferSelect;

// Order Items table (many-to-many relationship)
export const orderItems = pgTable('orderItems', {
    orderId: uuid('orderId').notNull().references(() => orders.id, { onDelete: 'cascade' }),
    menuItemId: uuid('menuItemId').notNull().references(() => menuItems.id, { onDelete: 'cascade' }),
    quantity: doublePrecision('quantity').notNull(), // Allow decimals for drinks? Or integer?
    priceAtOrder: doublePrecision('priceAtOrder').notNull(), // Price at the time of order
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    lastModified: timestamp("lastModified")
        .defaultNow()
        .notNull()
        .$onUpdateFn(() => new Date()),
});

export type OrderItemsSchemaT = typeof orderItems.$inferSelect;