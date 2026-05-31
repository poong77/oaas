-- knowledge-base-overhaul (Phase 1 Step A')
--   1) article_seq_counters — A7 운영 ID slug 채번 (atomic UPSERT, ticket-no-counter와 동일 패턴)
--   2) article_templates    — A1+ content_type별 본문 골격 마스터 (어드민 편집)
--
-- 본 마이그레이션은 generate 시 자동 포함된 위험 SQL을 제거하여 정리됨:
--   · DROP INDEX articles_search_tsv  — 0015에 raw SQL로 정의된 풀텍스트 인덱스 (schema 미정의로 매번 잡힘, 보존 필요)
--   · ALTER ... SET DEFAULT 들        — 무해하지만 별도 분리 필요 (다음 사이클에서 schema와 동기)
--   · ALTER business_hours_default ADD COLUMN — layout 사이클 누락분, 별도 마이그레이션으로 분리 권장

CREATE TABLE "article_seq_counters" (
	"product_code" text NOT NULL,
	"content_type" text NOT NULL,
	"last_seq" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "article_seq_counters_product_code_content_type_pk" PRIMARY KEY("product_code","content_type")
);
--> statement-breakpoint
CREATE TABLE "article_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"content_type" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"body_markdown" text NOT NULL,
	"outline" jsonb NOT NULL,
	"hover_preview" text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "article_templates_content_version_uq" ON "article_templates" USING btree ("content_type","version");
