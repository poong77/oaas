ALTER TABLE "users" ADD COLUMN "username" text;--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_uq" ON "users" USING btree ("username");