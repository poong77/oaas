CREATE TYPE "public"."ai_provider" AS ENUM('anthropic', 'openai');--> statement-breakpoint
CREATE TYPE "public"."ai_tier" AS ENUM('economy', 'balanced', 'premium');--> statement-breakpoint
CREATE TABLE "ai_models" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"provider" "ai_provider" NOT NULL,
	"code" text NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"tier" "ai_tier" DEFAULT 'balanced' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "embedding" vector(1536);--> statement-breakpoint
CREATE INDEX "tickets_embedding_hnsw" ON "tickets" USING hnsw ("embedding" vector_cosine_ops);