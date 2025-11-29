CREATE TYPE "public"."branchType" AS ENUM('branch', 'main');--> statement-breakpoint
ALTER TYPE "public"."activityAction" ADD VALUE 'USER_STORE_CHANGED';--> statement-breakpoint
ALTER TYPE "public"."inventoryStatus" ADD VALUE 'adjustment' BEFORE 'discontinued';--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_storeId_phone_unique";--> statement-breakpoint
CREATE INDEX "users_storeId_phone_unique" ON "users" USING btree ("storeId","phone") WHERE "phone"
                IS NOT NULL AND "phone" != '';--> statement-breakpoint
ALTER TABLE "menuItems" DROP COLUMN "currentMenu";--> statement-breakpoint
ALTER TABLE "menuItems" DROP COLUMN "minMenuLevel";