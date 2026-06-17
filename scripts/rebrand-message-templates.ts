/**
 * 메시지 템플릿 브랜드명 통일: [OA 통합 AS] → [OA서포트], "통합 AS 플랫폼" → "OA서포트"
 * 멱등. notification_templates + manual_message_templates 대상.
 * 실행: npx tsx scripts/rebrand-message-templates.ts          (드라이런)
 *       npx tsx scripts/rebrand-message-templates.ts --apply  (실제 반영)
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

import { connectPg } from '../db/connect';

const APPLY = process.argv.includes('--apply');

async function main() {
  const { pool, sql } = connectPg();

  const before = await sql<{ tbl: string; field: string; n: number }>`
    SELECT 'notification_templates' AS tbl, 'subject' AS field, count(*)::int AS n FROM notification_templates WHERE subject LIKE '%통합 AS%'
    UNION ALL SELECT 'notification_templates', 'body_template', count(*)::int FROM notification_templates WHERE body_template LIKE '%통합 AS%'
    UNION ALL SELECT 'manual_message_templates', 'subject', count(*)::int FROM manual_message_templates WHERE subject LIKE '%통합 AS%'
    UNION ALL SELECT 'manual_message_templates', 'body', count(*)::int FROM manual_message_templates WHERE body LIKE '%통합 AS%'
  `;
  console.log('===== 변경 대상 (통합 AS 포함 행) =====');
  for (const r of before) console.log(`  ${r.tbl}.${r.field}: ${r.n}`);

  if (!APPLY) {
    console.log('\n[드라이런] --apply 없으면 반영하지 않습니다.');
    await pool.end();
    return;
  }

  // 순서: 긴 문구 먼저 치환
  await sql`UPDATE notification_templates SET subject = replace(subject, '[OA 통합 AS]', '[OA서포트]'), updated_at = now() WHERE subject LIKE '%[OA 통합 AS]%'`;
  await sql`UPDATE notification_templates SET body_template = replace(body_template, '[OA 통합 AS]', '[OA서포트]'), updated_at = now() WHERE body_template LIKE '%[OA 통합 AS]%'`;
  await sql`UPDATE notification_templates SET body_template = replace(body_template, '통합 AS 플랫폼', 'OA서포트'), updated_at = now() WHERE body_template LIKE '%통합 AS 플랫폼%'`;
  await sql`UPDATE manual_message_templates SET subject = replace(subject, '[OA 통합 AS]', '[OA서포트]'), updated_at = now() WHERE subject LIKE '%[OA 통합 AS]%'`;
  await sql`UPDATE manual_message_templates SET body = replace(body, '[OA 통합 AS]', '[OA서포트]'), updated_at = now() WHERE body LIKE '%[OA 통합 AS]%'`;
  await sql`UPDATE manual_message_templates SET body = replace(body, '통합 AS 플랫폼', 'OA서포트'), updated_at = now() WHERE body LIKE '%통합 AS 플랫폼%'`;

  const after = await sql<{ tbl: string; n: number }>`
    SELECT 'notification_templates' AS tbl, count(*)::int AS n FROM notification_templates WHERE subject LIKE '%통합 AS%' OR body_template LIKE '%통합 AS%'
    UNION ALL SELECT 'manual_message_templates', count(*)::int FROM manual_message_templates WHERE subject LIKE '%통합 AS%' OR body LIKE '%통합 AS%'
  `;
  console.log('\n===== 반영 후 잔여 (통합 AS 포함 행) =====');
  for (const r of after) console.log(`  ${r.tbl}: ${r.n}`);
  console.log('\n[완료] 브랜드명 통일 반영됨.');

  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
