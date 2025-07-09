import {pgTable, text, /* doublePrecision, boolean, */ timestamp, uuid, pgEnum} from 'drizzle-orm/pg-core';
// import { relations } from 'drizzle-orm';

export const userRoleEnum = pgEnum("role", [
    "admin",
    "cashier",
    "user",
    "guest"
]);

export const userStatusEnum = pgEnum("status", [
    "active",
    "inactive",
    "deleted"
]);

// Users' table
export const users = pgTable('users', {
    id: uuid('id').defaultRandom().primaryKey(), // Using UUIDs for IDs
    firstName: text("firstName").notNull(),
    lastName: text("lastName").notNull(),
    email: text('email').unique().notNull(),
    password: text('password').notNull(),
    phone: text('phone').unique().default(''),
    role: userRoleEnum("role").notNull().default("user"), // 'cashier' || 'admin' || 'user' || 'guest'
    status: userStatusEnum("status").notNull().default("active"), // 'active' || 'inactive' || 'deleted'
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    lastModified: timestamp("lastModified")
        .defaultNow()
        .notNull()
        .$onUpdateFn(() => new Date()),
});

export type UserSchemaT = typeof users.$inferSelect;
//
// // Menu Items table
// export const menuItems = pgTable('menu_items', {
//     id: uuid('id').defaultRandom().primaryKey(),
//     name: text('name').notNull().unique(),
//     price: doublePrecision('price').notNull(),
//     isAvailable: boolean('is_available').notNull().default(true),
// });
//
// // Orders table
// export const orders = pgTable('orders', {
//     id: uuid('id').defaultRandom().primaryKey(),
//     totalAmount: doublePrecision('total_amount').notNull(),
//     paymentMethod: text('payment_method').notNull(), // 'cash' or 'card'
//     orderDate: timestamp('order_date').defaultNow().notNull(),
//     status: text('status').notNull().default('completed'), // 'completed', 'pending', etc.
//     // cashierId: uuid('cashier_id').references(() => users.id).notNull(), // Uncomment for MVP+
// });
//
// // Order Items table (many-to-many relationship)
// export const orderItems = pgTable('order_items', {
//     orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
//     menuItemId: uuid('menu_item_id').notNull().references(() => menuItems.id, { onDelete: 'cascade' }),
//     quantity: doublePrecision('quantity').notNull(), // Allow decimals for drinks? Or integer?
//     priceAtOrder: doublePrecision('price_at_order').notNull(), // Price at the time of order
// });
//
// // Define relations (optional for MVP, but good practice)
// export const ordersRelations = relations(orders, ({ many }) => ({
//     orderItems: many(orderItems),
// }));
//
// export const menuItemsRelations = relations(menuItems, ({ many }) => ({
//     orderItems: many(orderItems),
// }));
//
// export const orderItemsRelations = relations(orderItems, ({ one }) => ({
//     order: one(orders, {
//         fields: [orderItems.orderId],
//         references: [orders.id],
//     }),
//     menuItem: one(menuItems, {
//         fields: [orderItems.menuItemId],
//         references: [menuItems.id],
//     }),
// }));