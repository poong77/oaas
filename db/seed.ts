/**
 * 시드 데이터 — Phase 1.
 *
 * 실행: `npm run db:seed`  (DB 연결 필요)
 *   - DATABASE_URL이 placeholder면 사용자에게 안내 후 종료.
 *   - 기존 시드 데이터가 있으면 ON CONFLICT DO NOTHING으로 안전 idempotent.
 *
 * 시드 내용:
 *   - categories: product 6, issue_type 6, urgency 3, impact 4
 *   - solution_link_presets: 4
 *   - hotels: 1 (샘플 호텔)
 *   - users: admin / manager / hotelier 각 1명 (비번 'oa1234!')
 */

import 'dotenv/config';
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import { sql } from 'drizzle-orm';

import {
  categories,
  hotels,
  serviceStatus,
  solutionLinkPresets,
  users,
  type NewCategory,
  type NewHotel,
  type NewServiceStatus,
  type NewSolutionLinkPreset,
  type NewUser,
} from './schema';

const DATABASE_URL = process.env.DATABASE_URL ?? '';

async function main() {
  if (!DATABASE_URL || DATABASE_URL.includes('placeholder')) {
    console.error(
      '\n[seed] ❌ DATABASE_URL이 placeholder입니다.\n' +
        '       실제 Neon 연결 문자열로 교체한 뒤 다시 실행하세요.\n',
    );
    process.exit(1);
  }

  console.log('[seed] DB 연결 중...');
  const sqlClient = neon(DATABASE_URL);
  const db = drizzle(sqlClient);

  // ─── 1. categories ──────────────────────────────────────────────
  const productCats: NewCategory[] = [
    { type: 'product', code: 'pms', label: 'PMS', icon: 'Building2', sortOrder: 10 },
    { type: 'product', code: 'cms', label: 'CMS', icon: 'Layers', sortOrder: 20 },
    { type: 'product', code: 'keyless', label: 'Keyless', icon: 'KeyRound', sortOrder: 30 },
    { type: 'product', code: 'kiosk', label: '키오스크', icon: 'Monitor', sortOrder: 40 },
    { type: 'product', code: 'web', label: '웹서비스', icon: 'Globe', sortOrder: 50 },
    { type: 'product', code: 'config', label: '설정', icon: 'Settings', sortOrder: 60 },
  ];
  const issueTypeCats: NewCategory[] = [
    { type: 'issue_type', code: 'error', label: '오류', icon: 'AlertCircle', sortOrder: 10 },
    { type: 'issue_type', code: 'outage', label: '장애', icon: 'AlertTriangle', sortOrder: 20 },
    { type: 'issue_type', code: 'feature_inquiry', label: '기능문의', icon: 'HelpCircle', sortOrder: 30 },
    { type: 'issue_type', code: 'feature_request', label: '기능개발', icon: 'Sparkles', sortOrder: 40 },
    { type: 'issue_type', code: 'data_fix', label: '데이터수정', icon: 'Database', sortOrder: 50 },
    { type: 'issue_type', code: 'etc', label: '기타', icon: 'MoreHorizontal', sortOrder: 60 },
  ];
  const urgencyCats: NewCategory[] = [
    { type: 'urgency', code: 'p1', label: 'P1 (긴급)', icon: 'Flame', sortOrder: 10, meta: { color: 'red' } },
    { type: 'urgency', code: 'p2', label: 'P2 (보통)', icon: 'Zap', sortOrder: 20, meta: { color: 'amber' } },
    { type: 'urgency', code: 'p3', label: 'P3 (낮음)', icon: 'Clock', sortOrder: 30, meta: { color: 'slate' } },
  ];
  const impactCats: NewCategory[] = [
    { type: 'impact', code: 'all_hotels', label: '전체 호텔', sortOrder: 10 },
    { type: 'impact', code: 'single_hotel', label: '단일 호텔', sortOrder: 20 },
    { type: 'impact', code: 'single_user', label: '단일 사용자', sortOrder: 30 },
    { type: 'impact', code: 'info', label: '정보성', sortOrder: 40 },
  ];

  const allCategories = [
    ...productCats,
    ...issueTypeCats,
    ...urgencyCats,
    ...impactCats,
  ];

  console.log(`[seed] categories 삽입 ${allCategories.length}건...`);
  await db
    .insert(categories)
    .values(allCategories)
    .onConflictDoNothing({ target: [categories.type, categories.code] });

  // ─── 2. solution_link_presets ───────────────────────────────────
  const presets: NewSolutionLinkPreset[] = [
    { label: 'PMS', icon: 'Building2', sortOrder: 10 },
    { label: 'Keyless', icon: 'KeyRound', sortOrder: 20 },
    { label: '홈페이지', icon: 'Globe', sortOrder: 30 },
    { label: '기타', icon: 'Link', sortOrder: 40 },
  ];
  console.log(`[seed] solution_link_presets 삽입 ${presets.length}건...`);
  // presets는 unique 인덱스가 없어서 idempotency는 label 중복 확인으로 처리
  const existingPresetLabels = await db
    .select({ label: solutionLinkPresets.label })
    .from(solutionLinkPresets);
  const existingSet = new Set(existingPresetLabels.map((r) => r.label));
  const newPresets = presets.filter((p) => !existingSet.has(p.label));
  if (newPresets.length > 0) {
    await db.insert(solutionLinkPresets).values(newPresets);
  }

  // ─── 3. hotels ──────────────────────────────────────────────────
  console.log('[seed] sample 호텔 삽입...');
  const sampleHotel: NewHotel = {
    name: '샘플 호텔',
    oaPmsHotelId: 'SAMPLE-001',
    phone: '02-1234-5678',
    address: '서울특별시 강남구 테헤란로 123',
    managerName: '김호텔',
    note: '시드 데이터로 생성된 샘플 호텔',
  };
  await db
    .insert(hotels)
    .values(sampleHotel)
    .onConflictDoNothing({ target: hotels.oaPmsHotelId });

  const [hotelRow] = await db
    .select({ id: hotels.id })
    .from(hotels)
    .where(sql`${hotels.oaPmsHotelId} = ${sampleHotel.oaPmsHotelId}`);

  // ─── 4. users ───────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('oa1234!', 12);
  const seedUsers: NewUser[] = [
    {
      email: 'admin@oa.local',
      name: 'OA 어드민',
      role: 'admin',
      title: '플랫폼 관리자',
      phone: '010-0000-0001',
      passwordHash,
    },
    {
      email: 'manager@oa.local',
      name: 'OA 매니저',
      role: 'manager',
      title: 'AS 운영',
      phone: '010-0000-0002',
      passwordHash,
    },
    {
      email: 'hotelier@oa.local',
      name: '호텔 담당자',
      role: 'hotelier',
      title: '프론트',
      phone: '010-0000-0003',
      hotelId: hotelRow?.id ?? null,
      passwordHash,
    },
  ];
  console.log(`[seed] users 삽입 ${seedUsers.length}건...`);
  await db
    .insert(users)
    .values(seedUsers)
    .onConflictDoNothing({ target: users.email });

  // ─── 5. service_status (Phase 2) ────────────────────────────────
  // 활성 상태 row가 하나도 없으면 normal 1건을 시드한다 (idempotent).
  console.log('[seed] service_status 기본 row 확인...');
  const existingActive = await db
    .select({ id: serviceStatus.id })
    .from(serviceStatus)
    .where(sql`${serviceStatus.isActive} = true`)
    .limit(1);
  if (existingActive.length === 0) {
    const seedStatus: NewServiceStatus = {
      status: 'normal',
      message: '모든 서비스 정상',
    };
    await db.insert(serviceStatus).values(seedStatus);
    console.log('[seed]   ↳ normal 상태 1건 삽입');
  } else {
    console.log('[seed]   ↳ 이미 active row 존재, 스킵');
  }

  console.log('\n[seed] ✅ 완료. 로그인 계정:');
  console.log('       admin@oa.local    / oa1234!  (어드민)');
  console.log('       manager@oa.local  / oa1234!  (매니저)');
  console.log('       hotelier@oa.local / oa1234!  (호텔리어)\n');
}

main().catch((err) => {
  console.error('[seed] ❌ 실패:', err);
  process.exit(1);
});
