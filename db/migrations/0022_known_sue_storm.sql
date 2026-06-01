CREATE TABLE "search_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"query" text NOT NULL,
	"normalized_query" text NOT NULL,
	"result_counts" jsonb DEFAULT '{"help":0,"faq":0,"notice":0,"incident":0}'::jsonb NOT NULL,
	"total_results" integer DEFAULT 0 NOT NULL,
	"zero_result" boolean DEFAULT false NOT NULL,
	"clicked" boolean DEFAULT false NOT NULL,
	"clicked_kind" text,
	"clicked_ref" text,
	"clicked_position" integer,
	"led_to_ticket" boolean DEFAULT false NOT NULL,
	"product_code" text,
	"user_id" uuid,
	"role" text,
	"session_key" text
);
--> statement-breakpoint
ALTER TABLE "search_logs" ADD CONSTRAINT "search_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "search_logs_created_idx" ON "search_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "search_logs_zero_idx" ON "search_logs" USING btree ("zero_result");--> statement-breakpoint
CREATE INDEX "search_logs_norm_idx" ON "search_logs" USING btree ("normalized_query");--> statement-breakpoint
CREATE INDEX "search_logs_session_idx" ON "search_logs" USING btree ("session_key");