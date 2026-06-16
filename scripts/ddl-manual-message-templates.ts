/**
 * MSG-16 — `manual_message_templates` 멱등 DDL.
 *
 * 운영DB는 drizzle-kit migrate가 깨져 있어(저널 불일치) 직접 IF NOT EXISTS DDL로 적용한다.
 * drizzle-kit push 금지(검색 인덱스 DROP 위험). 이 스크립트는 멱등 — 여러 번 실행해도 안전.
 *
 * 실행: npx tsx scripts/ddl-manual-message-templates.ts
 */

import { sql } from 'drizzle-orm';
import { db } from '@/db';

async function main() {
  if (!db) {
    console.error('DB 연결 없음 (DATABASE_URL 확인)');
    process.exit(1);
  }

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS manual_message_templates (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      is_active boolean NOT NULL DEFAULT true,
      channel text NOT NULL,
      title text NOT NULL,
      memo text,
      subject text,
      body text NOT NULL,
      from_name text,
      from_local text,
      variables jsonb NOT NULL DEFAULT '[]'::jsonb,
      sort_order integer NOT NULL DEFAULT 0
    )
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS manual_message_templates_channel_sort_idx
      ON manual_message_templates (channel, sort_order)
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS manual_message_templates_active_idx
      ON manual_message_templates (is_active)
  `);

  // 검증
  const res = await db.execute<{ count: number }>(sql`
    SELECT count(*)::int AS count FROM manual_message_templates
  `);
  console.log('✅ manual_message_templates 준비 완료. 현재 행 수:', res.rows[0]?.count ?? 0);
  process.exit(0);
}

main().catch((err) => {
  console.error('DDL 실패:', err);
  process.exit(1);
});
