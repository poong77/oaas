-- 0007_ticket_channels: 유입 채널 마스터화 + tickets.channel enum→text
-- Plan: docs/01-plan/features/ticket-channels-master.plan.md
-- Design: docs/02-design/features/ticket-channels-master.design.md

CREATE TABLE "ticket_channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"code" text NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"icon" text,
	"selectable_in_agent_form" boolean DEFAULT true NOT NULL,
	"is_agent_default" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "ticket_channels_code_uniq" ON "ticket_channels" USING btree ("code");--> statement-breakpoint
CREATE INDEX "ticket_channels_sort_idx" ON "ticket_channels" USING btree ("sort_order");--> statement-breakpoint
-- 운영 1회성 시드 (dev는 db/seed.ts로 동일 데이터 idempotent 주입)
INSERT INTO "ticket_channels" ("code", "label", "icon", "sort_order", "selectable_in_agent_form", "is_agent_default") VALUES
	('web',     '웹',       'Globe',         10, FALSE, FALSE),
	('phone',   '전화',     'Phone',         20, TRUE,  TRUE),
	('chatbot', '챗봇',     'Bot',           30, FALSE, FALSE),
	('kakao',   '카카오톡', 'MessageCircle', 40, TRUE,  FALSE),
	('email',   '이메일',   'Mail',          50, TRUE,  FALSE),
	('walk_in', '방문',     'Footprints',    60, TRUE,  FALSE)
ON CONFLICT ("code") DO NOTHING;
--> statement-breakpoint
-- enum → text 변환 (기존 데이터 'web'/'phone'/'chatbot' 무손실 보존)
ALTER TABLE "tickets" ALTER COLUMN "channel" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "tickets" ALTER COLUMN "channel" SET DATA TYPE text USING "channel"::text;--> statement-breakpoint
ALTER TABLE "tickets" ALTER COLUMN "channel" SET DEFAULT 'web';--> statement-breakpoint
DROP TYPE "public"."ticket_channel_kind";