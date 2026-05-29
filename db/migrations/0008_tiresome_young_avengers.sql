CREATE TABLE "editor_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"user_id" uuid NOT NULL,
	"scope" varchar(50) NOT NULL,
	"target_id" uuid,
	"draft_key" varchar(200) NOT NULL,
	"content_markdown" text NOT NULL,
	"metadata" text
);
--> statement-breakpoint
ALTER TABLE "editor_drafts" ADD CONSTRAINT "editor_drafts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "editor_drafts_user_draft_key_uniq" ON "editor_drafts" USING btree ("user_id","draft_key");--> statement-breakpoint
CREATE INDEX "editor_drafts_user_id_idx" ON "editor_drafts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "editor_drafts_updated_at_idx" ON "editor_drafts" USING btree ("updated_at");