CREATE TYPE "public"."entityType" AS ENUM('order', 'menuItem', 'user', 'store', 'activity');--> statement-breakpoint
ALTER TYPE "public"."activityAction" ADD VALUE 'STORES_VIEWED' BEFORE 'STORE_CREATED';--> statement-breakpoint
ALTER TYPE "public"."activityAction" ADD VALUE 'STORE_VIEWED' BEFORE 'STORE_UPDATED';--> statement-breakpoint
ALTER TYPE "public"."activityAction" ADD VALUE 'MANAGER_REGISTERED';--> statement-breakpoint
ALTER TYPE "public"."activityAction" ADD VALUE 'USERS_VIEWED';--> statement-breakpoint
ALTER TYPE "public"."activityAction" ADD VALUE 'USER_VIEWED';--> statement-breakpoint
ALTER TYPE "public"."activityAction" ADD VALUE 'USER_DELETED';--> statement-breakpoint
ALTER TYPE "public"."activityAction" ADD VALUE 'USER_UPDATED';--> statement-breakpoint
ALTER TYPE "public"."activityAction" ADD VALUE 'PASSWORD_CHANGED';--> statement-breakpoint
ALTER TABLE "activityLog" ALTER COLUMN "entityType" SET DEFAULT 'activity'::"public"."entityType";--> statement-breakpoint
ALTER TABLE "activityLog" ALTER COLUMN "entityType" SET DATA TYPE "public"."entityType" USING "entityType"::"public"."entityType";--> statement-breakpoint
ALTER TABLE "activityLog" ALTER COLUMN "entityType" SET NOT NULL;