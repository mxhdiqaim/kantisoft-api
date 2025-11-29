ALTER TABLE "users" DROP CONSTRAINT "users_storeId_email_unique";--> statement-breakpoint
DROP INDEX "users_storeId_phone_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "users_phone_global_unique" ON "users" USING btree ("phone") WHERE "phone"
                    IS NOT NULL AND "phone" != '';--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_global_unique" ON "users" USING btree ("email") WHERE "email"
                    IS NOT NULL AND "email" != '';