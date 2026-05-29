CREATE TYPE "public"."term_group_category" AS ENUM('operation', 'housekeeping', 'fnb', 'frontdesk', 'pms', 'product', 'issue', 'role', 'misc');--> statement-breakpoint
CREATE TABLE "term_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"canonical_term" text NOT NULL,
	"category" "term_group_category" DEFAULT 'misc' NOT NULL,
	"description" text,
	"suggested_category_id" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "term_synonyms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"group_id" uuid NOT NULL,
	"term" text NOT NULL,
	"language" text DEFAULT 'ko' NOT NULL,
	"weight" integer DEFAULT 5 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "term_synonyms" ADD CONSTRAINT "term_synonyms_group_id_term_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."term_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "term_groups_canonical_uq" ON "term_groups" USING btree ("canonical_term");--> statement-breakpoint
CREATE INDEX "term_groups_category_idx" ON "term_groups" USING btree ("category");--> statement-breakpoint
CREATE INDEX "term_groups_sort_idx" ON "term_groups" USING btree ("sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "term_synonyms_group_term_uq" ON "term_synonyms" USING btree ("group_id","term","language");--> statement-breakpoint
CREATE INDEX "term_synonyms_term_idx" ON "term_synonyms" USING btree ("term");--> statement-breakpoint
CREATE INDEX "term_synonyms_group_idx" ON "term_synonyms" USING btree ("group_id");