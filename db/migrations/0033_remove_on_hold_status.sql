-- '보류'(on_hold) 상태 시스템 전체 제거 (major-overhaul P3-a).
-- 1) 기존 on_hold 티켓을 in_progress로 이전  2) enum 재생성(on_hold 제거)
-- Postgres는 enum 값 DROP을 지원하지 않으므로 type을 재생성한다.

-- default 제거 (text 변환 시 default 캐스팅 충돌 방지)
ALTER TABLE "public"."tickets" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
-- enum → text 임시 변환
ALTER TABLE "public"."tickets" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
-- 데이터 이전: on_hold → in_progress
UPDATE "public"."tickets" SET "status" = 'in_progress' WHERE "status" = 'on_hold';--> statement-breakpoint
-- 구 enum 제거 후 신 enum(3값) 생성
DROP TYPE "public"."ticket_status_kind";--> statement-breakpoint
CREATE TYPE "public"."ticket_status_kind" AS ENUM('received', 'in_progress', 'completed');--> statement-breakpoint
-- text → 신 enum 변환
ALTER TABLE "public"."tickets" ALTER COLUMN "status" SET DATA TYPE "public"."ticket_status_kind" USING "status"::"public"."ticket_status_kind";--> statement-breakpoint
-- default 복원
ALTER TABLE "public"."tickets" ALTER COLUMN "status" SET DEFAULT 'received';
