import {
    pgEnum,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
    uuid,
} from "drizzle-orm/pg-core";
import { stores } from "./stores-schema";
import { sql } from "drizzle-orm";

export const userRoleEnum = pgEnum("role", [
    "manager",
    "admin",
    "user",
    "guest",
]);

export const userStatusEnum = pgEnum("status", [
    "active",
    "inactive",
    "deleted",
    "banned",
]);

// Users' table
export const users = pgTable(
    "users",
    {
        id: uuid("id").defaultRandom().primaryKey(), // Using UUIDs for IDs
        firstName: text("firstName").notNull(),
        lastName: text("lastName").notNull(),
        email: text("email").notNull(),
        password: text("password").notNull(),
        phone: text("phone"),
        role: userRoleEnum("role").notNull().default("user"), // 'manager' || 'admin' || 'user' || 'guest'
        status: userStatusEnum("status").notNull().default("active"), // 'active' || 'inactive' || 'deleted'
        storeId: uuid("storeId").references(() => stores.id, {
            onDelete: "set null",
        }),
        createdAt: timestamp("createdAt").defaultNow().notNull(),
        lastModified: timestamp("lastModified")
            .defaultNow()
            .notNull()
            .$onUpdateFn(() => new Date()),
    },
    (table) => {
        return {
            // Phone: Global Unique (ignoring null/empty)
            phoneGlobalUnique: uniqueIndex("users_phone_global_unique")
                .on(table.phone) // Removed table.storeId to make it Global
                .where(
                    sql`"phone"
                    IS NOT NULL AND "phone" != ''`,
                ),

            // Email: Global Unique (ignoring null/empty)
            emailGlobalUnique: uniqueIndex("users_email_global_unique")
                .on(table.email) // Removed table.storeId to make it Global
                .where(
                    sql`"email"
                    IS NOT NULL AND "email" != ''`,
                ),
        };
    },
);

export type UserSchemaT = typeof users.$inferSelect;
export type InsertUserSchemaT = typeof users.$inferInsert; // Useful for strict typing on inserts
