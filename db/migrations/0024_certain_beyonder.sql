ALTER TABLE "faqs" ADD COLUMN "embedding" vector(1536);--> statement-breakpoint
CREATE INDEX "faqs_embedding_hnsw" ON "faqs" USING hnsw ("embedding" vector_cosine_ops);