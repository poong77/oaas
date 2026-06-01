-- D1 부채 정리: articles_search_tsv 인덱스를 schema에 명시 (drizzle generate 매번 DROP 시도 영구 차단)
-- 0015에서 같은 SQL로 이미 생성했으므로 IF NOT EXISTS로 멱등 처리.
CREATE INDEX IF NOT EXISTS "articles_search_tsv" ON "articles" USING gin (to_tsvector('simple', coalesce("title", '') || ' ' || coalesce("summary", '') || ' ' || coalesce("body_markdown", '')));