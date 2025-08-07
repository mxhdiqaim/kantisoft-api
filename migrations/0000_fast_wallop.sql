CREATE TYPE "public"."activityAction" AS ENUM('USER_LOGIN', 'USER_CREATED', 'STORES_VIEWED', 'STORE_CREATED', 'STORE_VIEWED', 'STORE_UPDATED', 'STORE_DELETED', 'MENU_ITEM_CREATED', 'MENU_ITEM_UPDATED', 'MENU_ITEM_DELETED', 'ORDER_CREATED', 'ORDER_STATUS_UPDATED', 'ORDER_DELETED', 'MANAGER_REGISTERED', 'USERS_VIEWED', 'USER_VIEWED', 'USER_DELETED', 'USER_UPDATED', 'PASSWORD_CHANGED');--> statement-breakpoint
CREATE TYPE "public"."entityType" AS ENUM('order', 'menuItem', 'user', 'store', 'activity');--> statement-breakpoint
CREATE TYPE "public"."paymentMethod" AS ENUM('card', 'cash', 'transfer');--> statement-breakpoint
CREATE TYPE "public"."orderStatus" AS ENUM('cancelled', 'completed', 'pending');--> statement-breakpoint
CREATE TYPE "public"."storeType" AS ENUM('restaurant', 'pharmacy', 'supermarket');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('manager', 'admin', 'user', 'guest');--> statement-breakpoint
CREATE TYPE "public"."status" AS ENUM('active', 'inactive', 'deleted', 'banned');--> statement-breakpoint
CREATE TABLE "activityLog" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid,
	"storeId" uuid,
	"action" "activityAction" NOT NULL,
	"entityId" text,
	"entityType" "entityType" DEFAULT 'activity' NOT NULL,
	"details" text NOT NULL,
	"isRead" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "menuItems" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"itemCode" text,
	"price" numeric(10, 2) NOT NULL,
	"storeId" uuid,
	"currentMenu" integer DEFAULT 0 NOT NULL,
	"minMenuLevel" integer DEFAULT 10,
	"isAvailable" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"lastModified" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "menuItems_name_store_unique" UNIQUE("storeId","name"),
	CONSTRAINT "menuItems_itemCode_store_unique" UNIQUE("storeId","itemCode")
);
--> statement-breakpoint
CREATE TABLE "orderItems" (
	"orderId" uuid NOT NULL,
	"menuItemId" uuid NOT NULL,
	"quantity" numeric NOT NULL,
	"priceAtOrder" double precision NOT NULL,
	"subTotal" double precision DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"lastModified" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text,
	"totalAmount" double precision NOT NULL,
	"paymentMethod" "paymentMethod" DEFAULT 'cash' NOT NULL,
	"orderDate" timestamp DEFAULT now() NOT NULL,
	"orderStatus" "orderStatus" DEFAULT 'completed' NOT NULL,
	"storeId" uuid,
	"sellerId" uuid NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"lastModified" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "orders_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
CREATE TABLE "stores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"location" text,
	"storeType" "storeType" DEFAULT 'restaurant' NOT NULL,
	"storeParentId" uuid,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firstName" text NOT NULL,
	"lastName" text NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"phone" text,
	"role" "role" DEFAULT 'user' NOT NULL,
	"status" "status" DEFAULT 'active' NOT NULL,
	"storeId" uuid,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"lastModified" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_storeId_phone_unique" UNIQUE("storeId","phone"),
	CONSTRAINT "users_storeId_email_unique" UNIQUE("storeId","email")
);
--> statement-breakpoint
ALTER TABLE "activityLog" ADD CONSTRAINT "activityLog_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activityLog" ADD CONSTRAINT "activityLog_storeId_stores_id_fk" FOREIGN KEY ("storeId") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menuItems" ADD CONSTRAINT "menuItems_storeId_stores_id_fk" FOREIGN KEY ("storeId") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orderItems" ADD CONSTRAINT "orderItems_orderId_orders_id_fk" FOREIGN KEY ("orderId") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orderItems" ADD CONSTRAINT "orderItems_menuItemId_menuItems_id_fk" FOREIGN KEY ("menuItemId") REFERENCES "public"."menuItems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_storeId_stores_id_fk" FOREIGN KEY ("storeId") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_sellerId_users_id_fk" FOREIGN KEY ("sellerId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stores" ADD CONSTRAINT "stores_storeParentId_stores_id_fk" FOREIGN KEY ("storeParentId") REFERENCES "public"."stores"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_storeId_stores_id_fk" FOREIGN KEY ("storeId") REFERENCES "public"."stores"("id") ON DELETE set null ON UPDATE no action;