CREATE TABLE "hotel_slack_channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"hotel_id" uuid NOT NULL,
	"channel_id" text NOT NULL,
	"channel_name" text,
	"channel_is_private" boolean DEFAULT false NOT NULL,
	"bot_joined" boolean DEFAULT false NOT NULL,
	"linked_by_user_id" uuid
);
--> statement-breakpoint
ALTER TABLE "hotel_slack_channels" ADD CONSTRAINT "hotel_slack_channels_hotel_id_hotels_id_fk" FOREIGN KEY ("hotel_id") REFERENCES "public"."hotels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "hotel_slack_channels_pair_uq" ON "hotel_slack_channels" USING btree ("hotel_id","channel_id");