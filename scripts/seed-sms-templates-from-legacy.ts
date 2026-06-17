/**
 * 레거시 SMS 샘플관리 → manual_message_templates 이관.
 *
 * 원본: pmsdev SmsSampleSettFrm → /kor/fo/sms/sample_list (scrape-legacy-sms.ts로 /tmp/sms_dump/records.json 추출).
 * 범위(사용자 결정 2026-06-16): 사용 ON + 본문 있음 − 테스트 4건 제외.
 * 매핑: 채널=문자(sms), 제목→'[오아테크] '+제목, subject='[오아테크]', 발송내용→body, 비고→memo.
 * 멱등: (channel, title) 동일 시 skip.
 *
 * 실행: npx tsx -r dotenv/config scripts/seed-sms-templates-from-legacy.ts dotenv_config_path=.env.local
 */

import { readFileSync } from 'node:fs';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { manualMessageTemplates } from '@/db/schema';

const RECORDS = '/tmp/sms_dump/records.json';
const SUBJECT = '[오아테크]';
const PREFIX = '[오아테크] ';
// 명백한 테스트성 항목 제외 (사용자 선택: 권장안)
const EXCLUDE = new Set(['noqrtest', 'DD', 'PG/BE', 'TEST 안내']);

type Rec = {
  sms_samp_title: string;
  sms_samp_content: string;
  sms_samp_remark: string;
  sms_samp_sort: string;
  sms_samp_use: string;
};

async function main() {
  if (!db) {
    console.error('DB 연결 없음');
    process.exit(1);
  }
  const records: Rec[] = JSON.parse(readFileSync(RECORDS, 'utf8')).records ?? [];

  const target = records.filter((r) => {
    const title = (r.sms_samp_title ?? '').trim();
    const body = (r.sms_samp_content ?? '').trim();
    return r.sms_samp_use === '1' && body.length > 0 && !EXCLUDE.has(title);
  });
  console.log(`대상 ${target.length}건 (전체 ${records.length})`);

  let created = 0;
  let skipped = 0;
  for (const r of target) {
    const title = `${PREFIX}${r.sms_samp_title.trim()}`;
    const existing = await db
      .select({ id: manualMessageTemplates.id })
      .from(manualMessageTemplates)
      .where(and(eq(manualMessageTemplates.channel, 'sms'), eq(manualMessageTemplates.title, title)))
      .limit(1);
    if (existing.length > 0) {
      console.log(`· skip(존재): ${title}`);
      skipped += 1;
      continue;
    }
    await db.insert(manualMessageTemplates).values({
      channel: 'sms',
      title,
      memo: (r.sms_samp_remark ?? '').trim() || null,
      subject: SUBJECT,
      body: r.sms_samp_content.replace(/\s+$/, ''),
      variables: [],
      sortOrder: Number.parseInt(r.sms_samp_sort, 10) || 0,
      isActive: true,
    });
    console.log(`✓ 생성: ${title}`);
    created += 1;
  }
  console.log(`\n완료 — 생성 ${created} · skip ${skipped} / 대상 ${target.length}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('이관 실패:', err);
  process.exit(1);
});
