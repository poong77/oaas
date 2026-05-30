-- P1-2: related_article_ids(uuid[]) → related_slugs(text[]) 데이터 백필.
--
-- 배경:
--   - Plan Q-14 / Design §4.2 (수동) 3): 0015에서는 운영 데이터 0건 가정으로 생략됨
--   - 매니저가 글 쓰기 시작 전 안전망으로 미리 백필
--
-- 동작:
--   - related_article_ids에 들어있는 uuid → 같은 articles 테이블에서 slug 조회 → related_slugs에 채움
--   - related_slugs가 이미 채워져 있으면 (cardinality > 0) 건드리지 않음 (멱등)
--   - 참조된 article이 inactive면 제외
--
-- 안전성:
--   - related_article_ids 컬럼은 DROP하지 않음 (다음 사이클 0017에서 분리)
--   - 운영 데이터 0건이면 0 rows updated (정상)

UPDATE "articles" a
SET "related_slugs" = COALESCE(
  (
    SELECT array_agg(other.slug)
    FROM "articles" other
    WHERE other.id = ANY(a.related_article_ids)
      AND other.is_active = true
  ),
  '{}'::text[]
)
WHERE a.related_article_ids IS NOT NULL
  AND array_length(a.related_article_ids, 1) > 0
  AND (a.related_slugs IS NULL OR cardinality(a.related_slugs) = 0);
