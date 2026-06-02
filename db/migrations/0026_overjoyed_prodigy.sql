ALTER TABLE "tickets" ADD COLUMN "channels" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "one_call_resolved" boolean DEFAULT false NOT NULL;