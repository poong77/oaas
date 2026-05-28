CREATE TYPE "public"."checklist_step_action_kind" AS ENUM('next', 'resolved', 'escalate');--> statement-breakpoint
CREATE TABLE "checklist_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"checklist_id" uuid NOT NULL,
	"step_no" integer NOT NULL,
	"title" text NOT NULL,
	"body_markdown" text,
	"condition_yes_action" "checklist_step_action_kind" DEFAULT 'next' NOT NULL,
	"condition_no_action" "checklist_step_action_kind" DEFAULT 'escalate' NOT NULL,
	"yes_label" text DEFAULT '예' NOT NULL,
	"no_label" text DEFAULT '아니오' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checklists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"product_code" text NOT NULL,
	"issue_type" text,
	"title" text NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"resolved_count" integer DEFAULT 0 NOT NULL,
	"escalated_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "faqs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"product_code" text NOT NULL,
	"issue_type" text,
	"question" text NOT NULL,
	"answer_markdown" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"helpful_yes" integer DEFAULT 0 NOT NULL,
	"helpful_no" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "checklist_steps" ADD CONSTRAINT "checklist_steps_checklist_id_checklists_id_fk" FOREIGN KEY ("checklist_id") REFERENCES "public"."checklists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "checklist_steps_checklist_step_uq" ON "checklist_steps" USING btree ("checklist_id","step_no");--> statement-breakpoint
CREATE INDEX "checklists_product_sort_idx" ON "checklists" USING btree ("product_code","sort_order");--> statement-breakpoint
CREATE INDEX "checklists_active_product_idx" ON "checklists" USING btree ("is_active","product_code");--> statement-breakpoint
CREATE INDEX "faqs_product_sort_idx" ON "faqs" USING btree ("product_code","sort_order");--> statement-breakpoint
CREATE INDEX "faqs_active_product_idx" ON "faqs" USING btree ("is_active","product_code");