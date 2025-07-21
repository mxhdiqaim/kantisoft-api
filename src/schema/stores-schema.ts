import { pgTable, text, timestamp, uuid, pgEnum } from "drizzle-orm/pg-core";

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
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
        .defaultNow()
        .$onUpdateFn(() => new Date()),
});

export type Store = typeof stores.$inferSelect;
export type NewStore = typeof stores.$inferInsert;
