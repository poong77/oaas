CREATE TYPE "public"."hotel_type" AS ENUM('direct', 'operator', 'chain', 'distributor');--> statement-breakpoint
CREATE TABLE "hotel_managed_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"hotel_id" uuid NOT NULL,
	"linked_hotel_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "hotels" ADD COLUMN "representative_name" text;--> statement-breakpoint
ALTER TABLE "hotels" ADD COLUMN "corporate_name" text;--> statement-breakpoint
ALTER TABLE "hotels" ADD COLUMN "hotel_type" "hotel_type";--> statement-breakpoint
ALTER TABLE "hotels" ADD COLUMN "contract_year" integer;--> statement-breakpoint
ALTER TABLE "hotels" ADD COLUMN "contract_month" integer;--> statement-breakpoint
ALTER TABLE "hotels" ADD COLUMN "slack_id" text;--> statement-breakpoint
ALTER TABLE "hotels" ADD COLUMN "extra_contacts" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "hotels" ADD COLUMN "extra_emails" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "hotel_solution_links" ADD COLUMN "preset_id" uuid;--> statement-breakpoint
ALTER TABLE "hotel_solution_links" ADD COLUMN "login_id" text;--> statement-breakpoint
ALTER TABLE "hotel_solution_links" ADD COLUMN "password_enc" text;--> statement-breakpoint
ALTER TABLE "hotel_managed_links" ADD CONSTRAINT "hotel_managed_links_hotel_id_hotels_id_fk" FOREIGN KEY ("hotel_id") REFERENCES "public"."hotels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hotel_managed_links" ADD CONSTRAINT "hotel_managed_links_linked_hotel_id_hotels_id_fk" FOREIGN KEY ("linked_hotel_id") REFERENCES "public"."hotels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "hotel_managed_links_pair_uq" ON "hotel_managed_links" USING btree ("hotel_id","linked_hotel_id");--> statement-breakpoint
ALTER TABLE "hotel_solution_links" ADD CONSTRAINT "hotel_solution_links_preset_id_solution_link_presets_id_fk" FOREIGN KEY ("preset_id") REFERENCES "public"."solution_link_presets"("id") ON DELETE set null ON UPDATE no action;