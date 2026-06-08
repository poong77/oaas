/**
 * hotelier_templates 시드 — 호텔리어 접수 템플릿 초기 3종.
 *
 * 실행: `npm run db:seed:hotelier-templates`
 *   - DATABASE_URL 필요 (.env.local / .env).
 *   - 멱등: title 기준 이미 있으면 건너뜀 (어드민이 편집하므로 덮어쓰지 않음).
 *
 * 접수폼 「자세한 내용」 위 버튼으로 노출되며, 클릭 시 content가 본문에 삽입된다.
 */

import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

import { connectPg } from './connect';
import { eq } from 'drizzle-orm';

import { hotelierTemplates, type NewHotelierTemplate } from './schema';

const DATABASE_URL = process.env.DATABASE_URL ?? '';

const ACCOUNT_TEMPLATE = [
  '**요청 구분**: 계정 생성 / 계정 삭제 (해당에 표시)',
  '',
  '**대상 직원 이름**: ',
  '**대상 직원 연락처/이메일**: ',
  '**부여(또는 회수)할 권한·직무**: (예: 프런트 / 예약 / 하우스키핑 / 관리자)',
  '**적용 희망 일시**: ',
  '**비고**: ',
].join('\n');

const REVENUE_TEMPLATE = [
  '**수정 대상 일자**: ',
  '**예약번호 / 객실번호**: ',
  '**현재 금액**: ',
  '**수정 후 금액**: ',
  '**수정 사유**: (예: 할인 누락, 결제수단 변경, 환불, 야간요금 오적용 등)',
  '**관련 결제/영수증 번호**: ',
  '**비고**: ',
].join('\n');

const OVERBOOKING_TEMPLATE = [
  '**발생 일자 (체크인 기준)**: ',
  '**객실 타입**: ',
  '**예약 채널**: (예: OTA(부킹/아고다/익스피디아 등) / 자체예약 / 워크인)',
  '**초과 예약 건수**: ',
  '**현재 가용 객실 수**: ',
  '**요청 사항**: (예: 예약 이동, 객실 배정 조정, 채널 재고 점검·마감)',
  '**비고**: ',
].join('\n');

const SEED: NewHotelierTemplate[] = [
  {
    title: '계정생성/삭제',
    category: '계정',
    content: ACCOUNT_TEMPLATE,
    sortOrder: 10,
  },
  {
    title: '매출수정',
    category: '매출',
    content: REVENUE_TEMPLATE,
    sortOrder: 20,
  },
  {
    title: '오버부킹',
    category: '예약',
    content: OVERBOOKING_TEMPLATE,
    sortOrder: 30,
  },
];

async function main() {
  if (!DATABASE_URL.startsWith('postgres')) {
    console.error('❌ DATABASE_URL 미설정. 중단.');
    process.exit(1);
  }
  const { db } = connectPg(DATABASE_URL);

  let inserted = 0;
  let skipped = 0;
  for (const t of SEED) {
    const existing = await db
      .select({ id: hotelierTemplates.id })
      .from(hotelierTemplates)
      .where(eq(hotelierTemplates.title, t.title))
      .limit(1);
    if (existing.length > 0) {
      skipped++;
      console.log(`  SKIP  ${t.title} (이미 존재)`);
      continue;
    }
    await db.insert(hotelierTemplates).values(t);
    inserted++;
    console.log(`  OK    ${t.title}`);
  }

  console.log(
    `\n✅ hotelier_templates 시드 완료 — 추가 ${inserted} / 건너뜀 ${skipped}`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error('hotelier_templates 시드 실패:', err);
  process.exit(1);
});
