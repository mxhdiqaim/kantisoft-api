import {
    pgEnum,
    pgTable,
    text,
    timestamp,
    unique,
    uuid,
} from "drizzle-orm/pg-core";
import { stores } from "./stores-schema";

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
            // Adding a composite unique constraint on (storeId, phone),
            // This will ensure:
            // - For a given storeId, all *non-NULL* phone numbers are unique.
            // - Multiple NULL phone numbers are allowed within the same storeId (standard SQL behaviour for unique indexes on nullable columns).
            storeIdPhoneUnique: unique("users_storeId_phone_unique").on(
                table.storeId,
                table.phone,
            ),

            // This will ensure:
            // - For a given storeId, the email must be unique.
            // - Since storeId is nullable, multiple users with NULL storeId can have the same email.
            //    (e.g., if you have 'global' users not assigned to any specific store, or store was deleted)
            storeIdEmailUnique: unique("users_storeId_email_unique").on(
                table.storeId,
                table.email,
            ),
        };
    },
);

export type UserSchemaT = typeof users.$inferSelect;
export type InsertUserSchemaT = typeof users.$inferInsert; // Useful for strict typing on inserts
