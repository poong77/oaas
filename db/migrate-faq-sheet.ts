/**
 * FAQ 데이터 마이그레이션 — AS 응대 스크립트 시트 이관.
 *
 * 출처: Google Sheets (제품 / 이슈유형 / Q / 답변 스크립트(최종)) 71건.
 *   - 데이터: db/data/faq-sheet.json (시트 → 전처리 산출물).
 *   - 시트의 빈 컬럼(이슈유형)은 질문·답변 내용 기반으로 6종(error/outage/
 *     feature_inquiry/feature_request/data_fix/etc) 중 하나로 자동 분류해 채움.
 *   - 답변 본문은 마크다운(번호 리스트·소제목·강조)으로 가독성 정리.
 *   - 제품 라벨 매핑: PMS→pms, CMS→cms, 키리스·도어락→keyless, 키오스크→kiosk.
 *     명백한 오라벨 2건만 보정(폰키→keyless, 예약 문자→web).
 *
 * 실행: `npm run db:migrate-faq-sheet`
 *   - DATABASE_URL 필요 (.env.local / .env).
 *   - 멱등: 동일 (productCode, question) 조합은 건너뜀. 재실행 안전.
 *   - 임베딩 미생성 → 이후 `npm run db:backfill-faq-embeddings`로 일괄 생성.
 */

import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { connectPg } from './connect';
import { and, eq, sql } from 'drizzle-orm';

import { faqs, type NewFaq } from './schema';

const DATABASE_URL = process.env.DATABASE_URL ?? '';

type SheetFaq = {
  productCode: string;
  issueType: string | null;
  question: string;
  answerMarkdown: string;
  keywords: string[];
  sortOrder: number;
};

async function main() {
  if (!DATABASE_URL.startsWith('postgres')) {
    console.error('❌ DATABASE_URL 미설정. 중단.');
    process.exit(1);
  }

  const rows = JSON.parse(
    readFileSync(join(import.meta.dirname, 'data', 'faq-sheet.json'), 'utf-8'),
  ) as SheetFaq[];

  const { db } = connectPg(DATABASE_URL);

  console.log(`📥 시트 FAQ ${rows.length}건 이관...`);
  let created = 0;
  let skipped = 0;
  for (const f of rows) {
    const existing = await db
      .select({ id: faqs.id })
      .from(faqs)
      .where(and(eq(faqs.productCode, f.productCode), eq(faqs.question, f.question)))
      .limit(1);
    if (existing.length > 0) {
      skipped++;
      console.log(`   SKIP  [${f.productCode}] ${f.question}`);
      continue;
    }
    const row: NewFaq = {
      productCode: f.productCode,
      issueType: f.issueType,
      question: f.question,
      answerMarkdown: f.answerMarkdown,
      keywords: f.keywords,
      sortOrder: f.sortOrder,
    };
    await db.insert(faqs).values(row);
    created++;
    console.log(`   NEW   [${f.productCode}/${f.issueType}] ${f.question}`);
  }

  console.log(`\n✅ 이관 완료 — 신규 ${created}건 / 스킵 ${skipped}건`);
  console.log('💡 다음: `npm run db:backfill-faq-embeddings` 로 임베딩 생성');
  await db.execute(sql`ANALYZE faqs`);
  process.exit(0);
}

main().catch((err) => {
  console.error('마이그레이션 실패:', err);
  process.exit(1);
});
