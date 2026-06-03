CREATE TYPE "public"."popular_keyword_kind" AS ENUM('pin', 'block');--> statement-breakpoint
CREATE TABLE "popular_keywords" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"keyword" text NOT NULL,
	"normalized_keyword" text NOT NULL,
	"kind" "popular_keyword_kind" DEFAULT 'pin' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX "popular_keywords_kind_idx" ON "popular_keywords" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "popular_keywords_norm_idx" ON "popular_keywords" USING btree ("normalized_keyword");