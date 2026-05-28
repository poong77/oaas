CREATE TYPE "public"."ticket_channel_kind" AS ENUM('web', 'phone', 'chatbot');--> statement-breakpoint
CREATE TYPE "public"."ticket_status_kind" AS ENUM('received', 'in_progress', 'on_hold', 'completed');--> statement-breakpoint
CREATE TYPE "public"."ticket_message_kind" AS ENUM('public', 'internal_memo', 'status_change', 'system');--> statement-breakpoint
CREATE TYPE "public"."ticket_form_field_input" AS ENUM('text', 'textarea', 'select', 'number', 'date', 'file');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('sms', 'email', 'slack');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('sent', 'failed', 'retry');--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"ticket_no" text NOT NULL,
	"hotel_id" uuid,
	"reporter_id" uuid,
	"product_code" text NOT NULL,
	"issue_type" text NOT NULL,
	"urgency" text NOT NULL,
	"impact_scope" text,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"custom_fields" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "ticket_status_kind" DEFAULT 'received' NOT NULL,
	"assignee_id" uuid,
	"due_date" timestamp with time zone,
	"channel" "ticket_channel_kind" DEFAULT 'web' NOT NULL,
	"contact_methods" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"slack_thread_ts" text,
	"slack_dev_thread_ts" text
);
--> statement-breakpoint
CREATE TABLE "ticket_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"ticket_id" uuid NOT NULL,
	"author_id" uuid,
	"kind" "ticket_message_kind" DEFAULT 'public' NOT NULL,
	"content" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"ticket_id" uuid NOT NULL,
	"message_id" uuid,
	"blob_url" text NOT NULL,
	"pathname" text NOT NULL,
	"original_name" text NOT NULL,
	"mime_type" text,
	"size_bytes" integer DEFAULT 0 NOT NULL,
	"uploader_id" uuid
);
--> statement-breakpoint
CREATE TABLE "ticket_form_fields" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"product_code" text,
	"field_key" text NOT NULL,
	"label" text NOT NULL,
	"input_type" "ticket_form_field_input" DEFAULT 'text' NOT NULL,
	"options" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"required" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"help_text" text
);
--> statement-breakpoint
CREATE TABLE "notification_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_event_key" text NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"to_address" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "notification_status" NOT NULL,
	"attempts" integer DEFAULT 1 NOT NULL,
	"error_message" text,
	"related_ticket_id" uuid,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_hotel_id_hotels_id_fk" FOREIGN KEY ("hotel_id") REFERENCES "public"."hotels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_attachments" ADD CONSTRAINT "ticket_attachments_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_attachments" ADD CONSTRAINT "ticket_attachments_message_id_ticket_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."ticket_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_attachments" ADD CONSTRAINT "ticket_attachments_uploader_id_users_id_fk" FOREIGN KEY ("uploader_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_related_ticket_id_tickets_id_fk" FOREIGN KEY ("related_ticket_id") REFERENCES "public"."tickets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tickets_ticket_no_uq" ON "tickets" USING btree ("ticket_no");--> statement-breakpoint
CREATE INDEX "tickets_status_created_idx" ON "tickets" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "tickets_reporter_created_idx" ON "tickets" USING btree ("reporter_id","created_at");--> statement-breakpoint
CREATE INDEX "tickets_hotel_created_idx" ON "tickets" USING btree ("hotel_id","created_at");--> statement-breakpoint
CREATE INDEX "tickets_assignee_status_idx" ON "tickets" USING btree ("assignee_id","status");--> statement-breakpoint
CREATE INDEX "tickets_urgency_status_idx" ON "tickets" USING btree ("urgency","status");--> statement-breakpoint
CREATE INDEX "ticket_messages_ticket_created_idx" ON "ticket_messages" USING btree ("ticket_id","created_at");--> statement-breakpoint
CREATE INDEX "ticket_messages_kind_idx" ON "ticket_messages" USING btree ("ticket_id","kind");--> statement-breakpoint
CREATE INDEX "ticket_attachments_ticket_idx" ON "ticket_attachments" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "ticket_attachments_message_idx" ON "ticket_attachments" USING btree ("message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ticket_form_fields_product_key_uq" ON "ticket_form_fields" USING btree ("product_code","field_key");--> statement-breakpoint
CREATE INDEX "ticket_form_fields_product_sort_idx" ON "ticket_form_fields" USING btree ("product_code","sort_order");--> statement-breakpoint
CREATE INDEX "notification_logs_ticket_created_idx" ON "notification_logs" USING btree ("related_ticket_id","created_at");--> statement-breakpoint
CREATE INDEX "notification_logs_status_idx" ON "notification_logs" USING btree ("status");