CREATE TABLE "article_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"article_id" uuid NOT NULL,
	"user_id" uuid,
	"helpful" boolean NOT NULL,
	"comment" text
);
--> statement-breakpoint
CREATE TABLE "articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"product_code" text NOT NULL,
	"category_path" text[],
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"summary_30s" text,
	"body_markdown" text NOT NULL,
	"toc" jsonb,
	"related_article_ids" uuid[],
	"author_id" uuid,
	"published_at" timestamp with time zone,
	"view_count" integer DEFAULT 0 NOT NULL,
	"helpful_yes" integer DEFAULT 0 NOT NULL,
	"helpful_no" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "article_feedback" ADD CONSTRAINT "article_feedback_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_feedback" ADD CONSTRAINT "article_feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "article_feedback_user_unique_idx" ON "article_feedback" USING btree ("article_id","user_id") WHERE user_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "articles_slug_uq" ON "articles" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "articles_product_published_idx" ON "articles" USING btree ("product_code","published_at");--> statement-breakpoint
CREATE INDEX "articles_active_published_idx" ON "articles" USING btree ("is_active","published_at");