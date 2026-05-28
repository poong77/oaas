CREATE TYPE "public"."notice_kind" AS ENUM('notice', 'release', 'incident');--> statement-breakpoint
CREATE TABLE "notices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"kind" "notice_kind" NOT NULL,
	"product_code" text,
	"title" text NOT NULL,
	"body_markdown" text NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"banner" boolean DEFAULT false NOT NULL,
	"banner_until" timestamp with time zone,
	"published_at" timestamp with time zone,
	"view_count" integer DEFAULT 0 NOT NULL,
	"author_id" uuid
);
--> statement-breakpoint
ALTER TABLE "notices" ADD CONSTRAINT "notices_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notices_active_published_idx" ON "notices" USING btree ("is_active","published_at");--> statement-breakpoint
CREATE INDEX "notices_product_published_idx" ON "notices" USING btree ("product_code","published_at");--> statement-breakpoint
CREATE INDEX "notices_banner_active_idx" ON "notices" USING btree ("banner","is_active");