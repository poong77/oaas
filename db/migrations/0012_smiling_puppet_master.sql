CREATE TABLE "business_holidays" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"date" date NOT NULL,
	"name" text NOT NULL,
	"is_recurring" boolean DEFAULT false NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "business_hours_default" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"weekday_open" time NOT NULL,
	"weekday_close" time NOT NULL,
	"lunch_start" time,
	"lunch_end" time,
	"intake_deadline" time,
	"saturday_closed" boolean DEFAULT true NOT NULL,
	"sunday_closed" boolean DEFAULT true NOT NULL,
	"holidays_closed" boolean DEFAULT true NOT NULL,
	"emergency_phone" text,
	"emergency_note" text,
	"timezone" text DEFAULT 'Asia/Seoul' NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "business_holidays" ADD CONSTRAINT "business_holidays_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_hours_default" ADD CONSTRAINT "business_hours_default_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "business_holidays_date_uniq" ON "business_holidays" USING btree ("date") WHERE is_active = true;