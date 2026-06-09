ALTER TABLE "notification_logs" ADD COLUMN "batch_id" uuid;--> statement-breakpoint
CREATE INDEX "notification_logs_batch_idx" ON "notification_logs" USING btree ("batch_id","created_at");