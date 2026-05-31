-- NT-04 홈 팝업 배너 (멱등 — 이미 schema가 다른 경로로 적용됐을 수 있음)
DO $$ BEGIN
  CREATE TYPE "public"."notice_popup_size" AS ENUM('small', 'medium', 'large');
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
ALTER TABLE "notices" ADD COLUMN IF NOT EXISTS "popup_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "notices" ADD COLUMN IF NOT EXISTS "popup_image_url" text;--> statement-breakpoint
ALTER TABLE "notices" ADD COLUMN IF NOT EXISTS "popup_size" "notice_popup_size" DEFAULT 'medium' NOT NULL;--> statement-breakpoint
ALTER TABLE "notices" ADD COLUMN IF NOT EXISTS "popup_until" timestamp with time zone;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notices_popup_active_idx" ON "notices" USING btree ("popup_enabled","is_active");
