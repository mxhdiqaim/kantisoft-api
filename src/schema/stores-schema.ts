/* eslint-disable @typescript-eslint/no-explicit-any */
import {pgEnum, pgTable, text, timestamp, uuid} from "drizzle-orm/pg-core";

export const storeTypeEnum = pgEnum("storeType", [
    "restaurant",
    "pharmacy",
    "supermarket",
]);

export const stores = pgTable("stores", {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    location: text("location"),
    storeType: storeTypeEnum("storeType").default("restaurant").notNull(),
    // Self-referencing foreign key for branches
    storeParentId: uuid("storeParentId").references((): any => stores.id, {
        onDelete: "set null",
    }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
        .defaultNow()
        .$onUpdateFn(() => new Date()),
});

export type StoreType = typeof stores.$inferSelect;
