CREATE TYPE "public"."paymentMethod" AS ENUM('card', 'cash', 'transfer');--> statement-breakpoint
CREATE TYPE "public"."orderStatus" AS ENUM('cancelled', 'completed', 'pending');--> statement-breakpoint
CREATE TABLE "menuItems" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"price" double precision NOT NULL,
	"isAvailable" boolean DEFAULT true NOT NULL,
	CONSTRAINT "menuItems_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "orderItems" (
	"orderId" uuid NOT NULL,
	"menuItemId" uuid NOT NULL,
	"quantity" double precision NOT NULL,
	"priceAtOrder" double precision NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"totalAmount" double precision NOT NULL,
	"paymentMethod" "paymentMethod" DEFAULT 'cash' NOT NULL,
	"orderDate" timestamp DEFAULT now() NOT NULL,
	"orderStatus" "orderStatus" DEFAULT 'completed' NOT NULL,
	"sellerId" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orderItems" ADD CONSTRAINT "orderItems_orderId_orders_id_fk" FOREIGN KEY ("orderId") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orderItems" ADD CONSTRAINT "orderItems_menuItemId_menuItems_id_fk" FOREIGN KEY ("menuItemId") REFERENCES "public"."menuItems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_sellerId_users_id_fk" FOREIGN KEY ("sellerId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;