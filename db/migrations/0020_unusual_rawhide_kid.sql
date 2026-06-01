-- Phase 2 시맨틱 검색 — pgvector 임베딩 컬럼 + HNSW 코사인 인덱스.
-- drizzle-kit generate는 CREATE EXTENSION을 emit하지 않으므로 수동 보강.
-- Neon은 pgvector 확장 지원. 멱등(IF NOT EXISTS) 처리.
CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "embedding" vector(1536);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "articles_embedding_hnsw" ON "articles" USING hnsw ("embedding" vector_cosine_ops);
