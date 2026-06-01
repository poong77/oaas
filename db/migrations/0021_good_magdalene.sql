CREATE TYPE "public"."search_eval_judge" AS ENUM('label', 'llm', 'hybrid');--> statement-breakpoint
CREATE TYPE "public"."search_eval_source" AS ENUM('faq', 'manual', 'llm');--> statement-breakpoint
CREATE TABLE "search_eval_queries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"query" text NOT NULL,
	"expected_article_slugs" text[] DEFAULT '{}'::text[] NOT NULL,
	"expected_faq_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"product_code" text,
	"source" "search_eval_source" DEFAULT 'manual' NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "search_eval_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"query_count" integer DEFAULT 0 NOT NULL,
	"hit1" double precision DEFAULT 0 NOT NULL,
	"hit3" double precision DEFAULT 0 NOT NULL,
	"mrr" double precision DEFAULT 0 NOT NULL,
	"ndcg" double precision DEFAULT 0 NOT NULL,
	"judge_mode" "search_eval_judge" DEFAULT 'label' NOT NULL,
	"params" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"details" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"triggered_by" uuid,
	"ran_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "search_eval_runs" ADD CONSTRAINT "search_eval_runs_triggered_by_users_id_fk" FOREIGN KEY ("triggered_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "search_eval_queries_active_idx" ON "search_eval_queries" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "search_eval_queries_source_idx" ON "search_eval_queries" USING btree ("source");--> statement-breakpoint
CREATE INDEX "search_eval_runs_ran_at_idx" ON "search_eval_runs" USING btree ("ran_at");