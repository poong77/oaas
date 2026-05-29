-- ticket_no_counter: 연도별 atomic 채번 카운터
-- 기존 MAX(ticket_no) 기반 채번을 대체. Neon replica lag race 제거.
-- INSERT ... ON CONFLICT DO UPDATE RETURNING으로 atomic 보장.
-- 시드(>=900000) 영역은 카운터에 포함하지 않고 운영 번호만 추적.

CREATE TABLE "ticket_no_counter" (
	"year" integer PRIMARY KEY NOT NULL,
	"last_no" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint

-- 기존 tickets에서 연도별 MAX(no) 추출하여 카운터 초기화.
-- 시드 영역(>=900000)과 비-규격 ticket_no는 제외.
INSERT INTO "ticket_no_counter" ("year", "last_no")
SELECT
  CAST(SUBSTRING("ticket_no" FROM 4 FOR 4) AS INTEGER) AS year,
  MAX(CAST(SUBSTRING("ticket_no" FROM 9) AS INTEGER)) AS last_no
FROM "tickets"
WHERE "ticket_no" ~ '^AS-[0-9]{4}-[0-9]{6}$'
  AND CAST(SUBSTRING("ticket_no" FROM 9) AS INTEGER) < 900000
GROUP BY CAST(SUBSTRING("ticket_no" FROM 4 FOR 4) AS INTEGER)
ON CONFLICT ("year") DO UPDATE
  SET "last_no" = GREATEST("ticket_no_counter"."last_no", EXCLUDED."last_no");
