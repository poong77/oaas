CREATE TYPE "public"."article_content_type" AS ENUM('howto', 'feature', 'troubleshoot');--> statement-breakpoint
CREATE TYPE "public"."article_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TABLE "article_redirects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"from_path" text NOT NULL,
	"to_slug" text NOT NULL,
	"reason" text
);
--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "content_type" "article_content_type" DEFAULT 'howto' NOT NULL;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "status" "article_status" DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "summary" text;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "keywords" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "applies_to" jsonb;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "related_slugs" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "last_editor_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "article_redirects_from_uq" ON "article_redirects" USING btree ("from_path");--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_last_editor_id_users_id_fk" FOREIGN KEY ("last_editor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "articles_product_ct_status_idx" ON "articles" USING btree ("product_code","content_type","status","published_at");--> statement-breakpoint
CREATE INDEX "articles_status_published_idx" ON "articles" USING btree ("status","published_at");--> statement-breakpoint
CREATE INDEX "articles_keywords_gin" ON "articles" USING gin ("keywords");--> statement-breakpoint
-- ─────────────────────────────────────────────────────────────────
-- 수동 보강 (Design §4.2 — 데이터 이관 + 표현식 인덱스 + default 제거)
-- ─────────────────────────────────────────────────────────────────
-- 1) summary_30s → summary 데이터 이관 (Q-13)
UPDATE "articles" SET "summary" = "summary_30s" WHERE "summary_30s" IS NOT NULL AND "summary" IS NULL;--> statement-breakpoint
-- 2) published_at IS NOT NULL → status='published' (Q-4)
UPDATE "articles" SET "status" = 'published' WHERE "published_at" IS NOT NULL;--> statement-breakpoint
-- 3) 풀텍스트 GIN 표현식 인덱스 — title + summary + body_markdown (Design §3.1, §11.1)
CREATE INDEX "articles_search_tsv" ON "articles" USING gin (
  to_tsvector('simple',
    coalesce("title", '') || ' ' ||
    coalesce("summary", '') || ' ' ||
    coalesce("body_markdown", '')
  )
);--> statement-breakpoint
-- 4) content_type DEFAULT 'howto' 제거 — 앱이 명시적으로 채우도록 (운영 row 안전 채움 후 제거)
ALTER TABLE "articles" ALTER COLUMN "content_type" DROP DEFAULT;