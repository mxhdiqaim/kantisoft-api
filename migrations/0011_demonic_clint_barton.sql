CREATE TYPE "public"."activityAction" AS ENUM('USER_LOGIN', 'USER_CREATED', 'STORE_CREATED', 'STORE_UPDATED', 'STORE_DELETED', 'MENU_ITEM_CREATED', 'MENU_ITEM_UPDATED', 'MENU_ITEM_DELETED', 'ORDER_CREATED', 'ORDER_STATUS_UPDATED', 'ORDER_DELETED');--> statement-breakpoint
CREATE TABLE "activityLog" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid,
	"storeId" uuid,
	"action" "activityAction" NOT NULL,
	"entityId" text,
	"entityType" text,
	"details" text NOT NULL,
	"isRead" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activityLog" ADD CONSTRAINT "activityLog_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activityLog" ADD CONSTRAINT "activityLog_storeId_stores_id_fk" FOREIGN KEY ("storeId") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;