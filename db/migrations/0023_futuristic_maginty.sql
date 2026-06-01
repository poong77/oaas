ALTER TABLE "faqs" ADD COLUMN "keywords" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
CREATE INDEX "faqs_keywords_gin" ON "faqs" USING gin ("keywords");