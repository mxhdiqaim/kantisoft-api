ALTER TABLE "orders" ADD COLUMN "reference" text;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_reference_unique" UNIQUE("reference");