ALTER TABLE "menuItems" ADD COLUMN "createdAt" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "menuItems" ADD COLUMN "lastModified" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "orderItems" ADD COLUMN "createdAt" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "orderItems" ADD COLUMN "lastModified" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "createdAt" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "lastModified" timestamp DEFAULT now() NOT NULL;