CREATE TYPE "public"."business_hours_override_kind" AS ENUM('short_hours', 'closed', 'custom');--> statement-breakpoint
CREATE TYPE "public"."business_hours_override_status" AS ENUM('scheduled', 'active', 'expired', 'canceled');--> statement-breakpoint
CREATE TABLE "business_hours_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"kind" "business_hours_override_kind" NOT NULL,
	"effective_from" date NOT NULL,
	"effective_until" date NOT NULL,
	"weekday_open" time,
	"weekday_close" time,
	"lunch_start" time,
	"lunch_end" time,
	"intake_deadline" time,
	"reason" text NOT NULL,
	"status" "business_hours_override_status" DEFAULT 'scheduled' NOT NULL,
	"applied_at" timestamp with time zone,
	"created_by" uuid
);
--> statement-breakpoint
ALTER TABLE "business_hours_overrides" ADD CONSTRAINT "business_hours_overrides_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;