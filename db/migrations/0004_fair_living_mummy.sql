CREATE TYPE "public"."ticket_feedback_rating_kind" AS ENUM('resolved', 'partial', 'unresolved');--> statement-breakpoint
CREATE TABLE "ticket_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"ticket_id" uuid NOT NULL,
	"rating" "ticket_feedback_rating_kind" NOT NULL,
	"comment" text,
	"submitted_by" uuid
);
--> statement-breakpoint
ALTER TABLE "ticket_feedback" ADD CONSTRAINT "ticket_feedback_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_feedback" ADD CONSTRAINT "ticket_feedback_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ticket_feedback_ticket_idx" ON "ticket_feedback" USING btree ("ticket_id","is_active");