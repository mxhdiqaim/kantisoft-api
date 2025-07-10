import {pgTable, text, timestamp, uuid, pgEnum} from 'drizzle-orm/pg-core';

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