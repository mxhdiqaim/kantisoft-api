ALTER TABLE "orderItems" ALTER COLUMN "quantity" SET DATA TYPE numeric;--> statement-breakpoint
ALTER TABLE "orderItems" ADD COLUMN "subTotal" double precision DEFAULT 0 NOT NULL;