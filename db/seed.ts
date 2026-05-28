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
  articles,
  categories,
  checklistSteps,
  checklists,
  faqs,
  hotels,
  serviceStatus,
  solutionLinkPresets,
  users,
  type ChecklistStepAction,
  type NewArticle,
  type NewCategory,
  type NewChecklist,
  type NewChecklistStep,
  type NewFaq,
  type NewHotel,
  type NewServiceStatus,
  type NewSolutionLinkPreset,
  type NewUser,
  type TocEntry,
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

  // ─── 6. articles (Phase 3) ──────────────────────────────────────
  console.log('[seed] sample 아티클 (Phase 3) 확인...');
  // manager@oa.local 작성자
  const [managerRow] = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`${users.email} = 'manager@oa.local'`);
  const authorId = managerRow?.id ?? null;

  type SeedArticle = {
    productCode: string;
    slug: string;
    title: string;
    summary30s: string;
    bodyMarkdown: string;
    categoryPath: string[];
  };

  const seedArticles: SeedArticle[] = [
    {
      productCode: 'pms',
      slug: 'pms-payment-error-troubleshooting',
      title: 'PMS 결제 오류 발생 시 점검 절차',
      summary30s:
        '결제 단말 통신 실패와 카드 승인 오류는 원인이 다릅니다. 단말 상태 → 네트워크 → 가맹점 한도 순으로 빠르게 확인하세요.',
      categoryPath: ['결제', '오류'],
      bodyMarkdown: `## 증상 확인

PMS 결제 화면에서 "승인 실패" 또는 "통신 오류" 메시지가 표시되는 경우 다음 항목을 순서대로 점검하세요.

## 1단계 — 단말 상태 점검

- 단말 화면에 "준비" 표시가 떠 있는지 확인
- 카드 슬롯 / IC 단자 청결 상태 확인
- 단말 재부팅(전원 분리 후 30초 대기)

## 2단계 — 네트워크 점검

PMS 서버와 단말의 연결을 확인합니다. 객실 단말이 사내 Wi-Fi에 정상 접속되어 있는지 확인하고, 라우터 재시작도 시도해보세요.

## 3단계 — 가맹점 한도 / VAN사 점검

승인이 거절되면 VAN사 콜센터에 가맹점 한도, 사용 가능 카드사 목록을 확인하세요.

## 추가 안내

해결되지 않으면 문의 접수 시 단말 시리얼 번호, 오류 메시지, 발생 시각을 함께 적어주세요.`,
    },
    {
      productCode: 'cms',
      slug: 'cms-inventory-sync-issue',
      title: 'CMS 객실 재고 미반영 해결 가이드',
      summary30s:
        '예약된 객실의 재고가 CMS와 PMS 사이에서 불일치할 때 동기화 큐를 강제 재실행하는 방법입니다.',
      categoryPath: ['객실관리', '동기화'],
      bodyMarkdown: `## 문제 상황

CMS에서 예약을 변경했는데 PMS 룸차트에 반영되지 않는 경우가 있습니다.

## 점검 순서

### 1. 동기화 상태 확인

CMS 관리자 화면 우측 상단 "동기화 상태"가 정상(녹색)인지 확인합니다.

### 2. 강제 재동기화

상태가 비정상이면 "재동기화" 버튼을 클릭하세요. 5분 이내에 자동 보정됩니다.

### 3. 그래도 안 되면

큐가 막혀있을 수 있습니다. 매니저에게 큐 점검을 요청하세요.

## 예방

야간 일괄 동기화는 매일 03:00에 자동 실행됩니다. 매뉴얼 작업은 가급적 영업 시간 외에 해주세요.`,
    },
    {
      productCode: 'keyless',
      slug: 'keyless-key-issue-failure',
      title: 'Keyless 카드키 발급 실패 해결',
      summary30s:
        '신규 카드키 발급 실패는 보통 카드 리더 펌웨어 또는 객실 락 등록 문제입니다.',
      categoryPath: ['카드키', '발급'],
      bodyMarkdown: `## 증상

체크인 시 카드키 발급기에서 "발급 실패" 메시지가 표시됩니다.

## 원인별 해결

### 카드 리더 펌웨어

카드 리더 상태 LED가 적색이면 펌웨어 오작동입니다. 재부팅 후에도 적색이면 단말 교체가 필요합니다.

### 객실 락 등록 미완료

신규 객실은 락 마스터에 등록되어야 카드키 발급이 가능합니다. 시스템 → 객실 → 락 등록 메뉴에서 확인하세요.

### 만료된 카드 자재

빈 카드 재고가 손상된 경우 다른 카드로 시도해보세요.

## 긴급 응대

게스트가 대기중일 때는 비상 마스터키로 우선 응대 후 별도 처리하세요.`,
    },
    {
      productCode: 'kiosk',
      slug: 'kiosk-payment-terminal-disconnect',
      title: '키오스크 결제 단말 연결 안 될 때',
      summary30s:
        '키오스크와 결제 단말 사이 USB / 시리얼 연결이 끊어진 경우 빠른 복구 방법입니다.',
      categoryPath: ['키오스크', '단말'],
      bodyMarkdown: `## 증상

키오스크 결제 단계에서 "단말 연결 실패" 메시지가 표시됩니다.

## 1. 케이블 확인

- USB 케이블 양쪽이 깊게 꽂혀 있는지 확인
- 케이블 손상(꺾임, 단선) 확인

## 2. 키오스크 재시작

상단 메뉴 → 시스템 → 결제 단말 재초기화를 실행합니다. 약 30초 소요됩니다.

## 3. 시리얼 포트 충돌

다른 USB 장치를 분리한 후 결제 단말만 연결해보세요. COM 포트 번호 변경 시 재시작이 필요합니다.

## 대안 안내

복구 전까지는 프런트 직접 결제로 전환할 수 있습니다.`,
    },
    {
      productCode: 'web',
      slug: 'web-domain-ssl-renewal',
      title: '웹서비스 도메인 SSL 갱신 가이드',
      summary30s:
        '호텔 홈페이지 SSL 인증서는 90일 주기로 자동 갱신됩니다. 갱신 실패 시 점검 방법입니다.',
      categoryPath: ['웹서비스', 'SSL'],
      bodyMarkdown: `## 자동 갱신 정책

OA 웹서비스는 Let's Encrypt 인증서를 사용하며, 만료 30일 전부터 자동 갱신을 시도합니다.

## 갱신 실패 시 확인

### 1. DNS 레코드 점검

A 레코드가 OA 서버 IP를 올바르게 가리키는지 확인하세요.

### 2. 도메인 NS 변경 여부

최근 도메인 등록 업체를 변경했다면 NS 전파에 24~48시간이 걸릴 수 있습니다.

### 3. CAA 레코드

CAA 레코드가 \`letsencrypt.org\`를 허용하는지 확인하세요.

## 수동 갱신 요청

자동 갱신이 3회 연속 실패하면 매니저에게 문의하여 수동 갱신을 요청하세요.`,
    },
    {
      productCode: 'config',
      slug: 'admin-password-recovery',
      title: '관리자 비밀번호 분실 시 복구 절차',
      summary30s:
        '관리자 본인이 비밀번호를 잊어버렸을 때 안전하게 복구하는 절차입니다.',
      categoryPath: ['계정', '복구'],
      bodyMarkdown: `## 1단계 — 본인 인증

등록된 휴대폰 번호로 인증 코드를 받습니다. 휴대폰 변경 시 OA 운영팀에 직접 연락하세요.

## 2단계 — 임시 비밀번호 발급

인증 완료 후 임시 비밀번호가 SMS로 발송됩니다.

## 3단계 — 새 비밀번호 설정

첫 로그인 시 새 비밀번호 설정이 강제됩니다. 안전한 비밀번호 규칙:

- 영문 대소문자 + 숫자 + 특수문자 조합
- 8자 이상
- 이전 3개 비밀번호와 다름

## 보안 안내

복구 절차 중 발생한 활동은 모두 감사 로그에 기록됩니다.`,
    },
  ];

  let createdCount = 0;
  let skippedCount = 0;
  for (const a of seedArticles) {
    // idempotent: slug 중복 확인
    const existing = await db
      .select({ id: articles.id })
      .from(articles)
      .where(sql`${articles.slug} = ${a.slug}`)
      .limit(1);
    if (existing.length > 0) {
      skippedCount++;
      continue;
    }
    const toc = extractTocLocal(a.bodyMarkdown);
    const row: NewArticle = {
      productCode: a.productCode,
      categoryPath: a.categoryPath,
      slug: a.slug,
      title: a.title,
      summary30s: a.summary30s,
      bodyMarkdown: a.bodyMarkdown,
      toc,
      authorId,
      publishedAt: new Date(),
    };
    await db.insert(articles).values(row);
    createdCount++;
  }
  console.log(
    `[seed] articles: ${createdCount}건 신규 / ${skippedCount}건 스킵 (이미 존재)`,
  );

  // ─── 7. faqs (Phase 4) ─────────────────────────────────────────
  console.log('[seed] sample FAQ (Phase 4) 확인...');
  type SeedFaq = {
    productCode: string;
    issueType: string | null;
    question: string;
    answerMarkdown: string;
    sortOrder: number;
  };
  const seedFaqs: SeedFaq[] = [
    // PMS × 2
    {
      productCode: 'pms',
      issueType: 'error',
      sortOrder: 10,
      question: 'PMS 로그인이 안 되는데 어떻게 해야 하나요?',
      answerMarkdown:
        '1. 브라우저 캐시를 지운 뒤 다시 시도해주세요.\n2. Caps Lock이 켜져 있지 않은지 확인하세요.\n3. 비밀번호 분실 시 관리자에게 임시 비밀번호 발급을 요청하세요.\n4. 그래도 안 되면 회사 네트워크 / VPN 연결 상태를 확인해주세요.',
    },
    {
      productCode: 'pms',
      issueType: 'feature_inquiry',
      sortOrder: 20,
      question: '룸차트 위에서 마우스로 끌어서 예약을 옮길 수 있나요?',
      answerMarkdown:
        '네, 가능합니다. 예약 박스 위에서 마우스를 누른 채로 다른 객실/날짜 칸으로 드래그하세요. 단, **체크인 완료된 예약**은 잠금 처리되어 이동할 수 없습니다.',
    },
    // CMS × 2
    {
      productCode: 'cms',
      issueType: 'feature_inquiry',
      sortOrder: 10,
      question: 'OTA(부킹닷컴 등) 요금을 일괄로 조정할 수 있나요?',
      answerMarkdown:
        '`CMS > 요금 관리 > 일괄 변경`에서 기간·OTA·요금제를 선택해 % 또는 정액으로 일괄 조정할 수 있습니다. 변경 후 동기화는 평균 5분 이내에 완료됩니다.',
    },
    {
      productCode: 'cms',
      issueType: 'error',
      sortOrder: 20,
      question: 'CMS에서 변경한 재고가 PMS에 반영되지 않습니다',
      answerMarkdown:
        '동기화 상태가 비정상일 가능성이 큽니다. CMS 우측 상단의 **동기화 상태**가 녹색인지 확인하고, 비정상이면 "재동기화" 버튼을 눌러주세요. 5분 후에도 반영되지 않으면 매니저에게 큐 점검을 요청하세요.',
    },
    // Keyless × 2
    {
      productCode: 'keyless',
      issueType: 'error',
      sortOrder: 10,
      question: '카드키 발급 시 "발급 실패" 오류가 나옵니다',
      answerMarkdown:
        '1. 카드 리더 상태 LED가 적색이면 펌웨어 이상입니다 — 단말 재부팅.\n2. 신규 객실은 락 마스터 등록이 필요합니다. `시스템 > 객실 > 락 등록` 확인.\n3. 빈 카드 자재가 손상되었을 수 있으니 새 카드로 재시도하세요.',
    },
    {
      productCode: 'keyless',
      issueType: 'feature_inquiry',
      sortOrder: 20,
      question: '체크아웃 후 카드키를 자동으로 만료시킬 수 있나요?',
      answerMarkdown:
        '기본 설정으로 체크아웃 시점에 즉시 만료됩니다. 만약 청소 / 점검 시간을 위해 30분 정도 유예가 필요하다면 `Keyless > 정책 > 카드 만료 유예`에서 조정할 수 있습니다.',
    },
    // Kiosk × 2
    {
      productCode: 'kiosk',
      issueType: 'error',
      sortOrder: 10,
      question: '키오스크가 결제 단계에서 멈춥니다',
      answerMarkdown:
        '결제 단말 연결 문제일 가능성이 큽니다.\n1. USB 케이블 양쪽이 깊게 꽂혀 있는지 확인.\n2. 상단 메뉴 → 시스템 → 결제 단말 재초기화.\n3. 그래도 안 되면 프런트 직접 결제로 우선 전환 후 매니저에게 문의.',
    },
    {
      productCode: 'kiosk',
      issueType: 'feature_inquiry',
      sortOrder: 20,
      question: '키오스크 메인 화면 광고 이미지를 변경하려면?',
      answerMarkdown:
        '`키오스크 > 디스플레이 > 메인 슬라이드` 메뉴에서 이미지를 업로드/순서 변경할 수 있습니다. 1920×1080 권장 사이즈이며, 5MB 이하로 업로드하세요.',
    },
    // Web × 2
    {
      productCode: 'web',
      issueType: 'feature_inquiry',
      sortOrder: 10,
      question: '호텔 홈페이지의 다국어를 추가하려면?',
      answerMarkdown:
        '`웹서비스 > 다국어 설정`에서 지원할 언어를 추가하고 각 페이지/메뉴 별 번역을 입력하세요. 자동 번역은 일본어·중국어·영어를 기본 지원하며 검수 후 적용됩니다.',
    },
    {
      productCode: 'web',
      issueType: 'error',
      sortOrder: 20,
      question: '홈페이지가 https로 열리지 않습니다',
      answerMarkdown:
        'SSL 인증서 갱신 실패일 가능성이 큽니다. 1) DNS A 레코드가 올바른지 확인, 2) CAA 레코드가 `letsencrypt.org`를 허용하는지 확인, 3) 그래도 안 되면 매니저에게 수동 갱신을 요청하세요.',
    },
    // Config × 2
    {
      productCode: 'config',
      issueType: 'feature_inquiry',
      sortOrder: 10,
      question: '직원 계정을 추가하려면 어떻게 하나요?',
      answerMarkdown:
        '`프로필 > 직원 관리`에서 추가할 수 있습니다 (호텔리어 기준). 이름·이메일·역할(프론트/하우스키핑 등)을 지정하면 초대 메일이 발송됩니다.',
    },
    {
      productCode: 'config',
      issueType: 'error',
      sortOrder: 20,
      question: '관리자 비밀번호를 분실했어요',
      answerMarkdown:
        '1. 등록된 휴대폰 번호로 인증 코드를 받으세요.\n2. 인증 완료 후 임시 비밀번호가 SMS로 발송됩니다.\n3. 첫 로그인 시 새 비밀번호 설정이 강제됩니다.\n\n휴대폰 번호도 분실했다면 OA 운영팀(매니저)에게 직접 연락주세요.',
    },
  ];

  let faqCreated = 0;
  let faqSkipped = 0;
  for (const f of seedFaqs) {
    const existing = await db
      .select({ id: faqs.id })
      .from(faqs)
      .where(
        sql`${faqs.productCode} = ${f.productCode} AND ${faqs.question} = ${f.question}`,
      )
      .limit(1);
    if (existing.length > 0) {
      faqSkipped++;
      continue;
    }
    const row: NewFaq = {
      productCode: f.productCode,
      issueType: f.issueType,
      question: f.question,
      answerMarkdown: f.answerMarkdown,
      sortOrder: f.sortOrder,
    };
    await db.insert(faqs).values(row);
    faqCreated++;
  }
  console.log(
    `[seed] faqs: ${faqCreated}건 신규 / ${faqSkipped}건 스킵 (이미 존재)`,
  );

  // ─── 8. checklists + checklist_steps (Phase 4) ──────────────────
  console.log('[seed] sample 체크리스트 (Phase 4) 확인...');
  type SeedStep = {
    title: string;
    bodyMarkdown?: string;
    conditionYesAction: ChecklistStepAction;
    conditionNoAction: ChecklistStepAction;
    yesLabel?: string;
    noLabel?: string;
  };
  type SeedChecklist = {
    productCode: string;
    issueType: string | null;
    title: string;
    description: string;
    sortOrder: number;
    steps: SeedStep[];
  };

  const seedChecklists: SeedChecklist[] = [
    {
      productCode: 'pms',
      issueType: 'error',
      title: 'PMS 결제 오류 트러블슈팅',
      description: '체크인/체크아웃 시 결제 단말 오류가 발생할 때 단계별로 진단합니다.',
      sortOrder: 10,
      steps: [
        {
          title: '결제 단말 화면에 "준비" 표시가 떠 있나요?',
          bodyMarkdown:
            '단말 LED 또는 디스플레이에 정상 상태(보통 녹색)가 표시되는지 확인하세요.',
          conditionYesAction: 'next',
          conditionNoAction: 'escalate',
          yesLabel: '예, 준비됨',
          noLabel: '아니오, 빨간색 또는 꺼져 있음',
        },
        {
          title: '단말과 PMS 사이 케이블/네트워크는 연결되어 있나요?',
          bodyMarkdown:
            'USB / 시리얼 케이블이 단말과 PC에 단단히 꽂혀 있는지 확인합니다. 무선 단말이라면 객실 Wi-Fi 강도를 확인하세요.',
          conditionYesAction: 'next',
          conditionNoAction: 'escalate',
          yesLabel: '예, 연결됨',
          noLabel: '아니오 / 모르겠음',
        },
        {
          title: '단말을 재부팅 후에도 오류가 계속되나요?',
          bodyMarkdown:
            '단말 전원을 분리하고 30초 정도 기다린 뒤 다시 켜보세요. 그 후에도 같은 메시지가 나타나면 VAN사 문제일 가능성이 큽니다.',
          conditionYesAction: 'escalate',
          conditionNoAction: 'resolved',
          yesLabel: '예, 여전히 오류',
          noLabel: '아니오, 해결됨',
        },
        {
          title: 'VAN사(가맹점) 콜센터에서 한도/제한이 확인되었나요?',
          bodyMarkdown:
            'VAN사에 가맹점 한도, 사용 가능 카드사 목록 등을 확인합니다.',
          conditionYesAction: 'resolved',
          conditionNoAction: 'escalate',
          yesLabel: '예, 한도 조정 완료',
          noLabel: '아니오 / 도움 필요',
        },
      ],
    },
    {
      productCode: 'keyless',
      issueType: 'error',
      title: 'Keyless 카드키 발급 실패',
      description: '신규 카드키 발급이 안 될 때 점검 절차입니다.',
      sortOrder: 20,
      steps: [
        {
          title: '카드 리더 상태 LED가 적색인가요?',
          bodyMarkdown: 'LED가 적색이면 펌웨어 오작동 가능성이 있습니다.',
          conditionYesAction: 'next',
          conditionNoAction: 'next',
          yesLabel: '예, 적색',
          noLabel: '아니오, 정상',
        },
        {
          title: '단말을 재부팅하면 LED가 정상(녹색)으로 돌아오나요?',
          conditionYesAction: 'next',
          conditionNoAction: 'escalate',
          yesLabel: '예',
          noLabel: '아니오, 적색 유지',
        },
        {
          title: '발급 대상 객실이 락 마스터에 등록되어 있나요?',
          bodyMarkdown:
            '`시스템 > 객실 > 락 등록` 메뉴에서 해당 객실 번호를 검색해보세요.',
          conditionYesAction: 'next',
          conditionNoAction: 'escalate',
          yesLabel: '예, 등록됨',
          noLabel: '아니오 / 모르겠음',
        },
        {
          title: '다른 카드(새 카드 자재)로 재시도하니 발급되나요?',
          conditionYesAction: 'resolved',
          conditionNoAction: 'escalate',
          yesLabel: '예, 발급됨',
          noLabel: '아니오, 동일 오류',
        },
      ],
    },
    {
      productCode: 'kiosk',
      issueType: 'error',
      title: '키오스크 화면 멈춤 진단',
      description: '키오스크 화면이 멈췄을 때 응급 복구 단계.',
      sortOrder: 30,
      steps: [
        {
          title: '키오스크 화면 터치에 전혀 반응이 없나요?',
          conditionYesAction: 'next',
          conditionNoAction: 'resolved',
          yesLabel: '예, 무반응',
          noLabel: '아니오, 일부 반응',
        },
        {
          title: '키오스크 본체 전원 표시등은 켜져 있나요?',
          bodyMarkdown:
            '본체 하단 / 측면의 전원 LED를 확인하세요. 꺼져 있으면 전원 문제입니다.',
          conditionYesAction: 'next',
          conditionNoAction: 'escalate',
          yesLabel: '예, 켜짐',
          noLabel: '아니오, 꺼짐',
        },
        {
          title:
            '관리자 모드(우측 상단 5회 탭) 진입 후 "재부팅"을 누르니 복구되나요?',
          conditionYesAction: 'resolved',
          conditionNoAction: 'escalate',
          yesLabel: '예, 정상화',
          noLabel: '아니오, 멈춘 상태',
        },
      ],
    },
  ];

  let clCreated = 0;
  let clSkipped = 0;
  let stepCreated = 0;
  for (const c of seedChecklists) {
    const existing = await db
      .select({ id: checklists.id })
      .from(checklists)
      .where(
        sql`${checklists.productCode} = ${c.productCode} AND ${checklists.title} = ${c.title}`,
      )
      .limit(1);
    if (existing.length > 0) {
      clSkipped++;
      continue;
    }
    const row: NewChecklist = {
      productCode: c.productCode,
      issueType: c.issueType,
      title: c.title,
      description: c.description,
      sortOrder: c.sortOrder,
    };
    const [created] = await db
      .insert(checklists)
      .values(row)
      .returning({ id: checklists.id });
    if (!created) continue;
    clCreated++;

    const stepRows: NewChecklistStep[] = c.steps.map((s, idx) => ({
      checklistId: created.id,
      stepNo: idx + 1,
      title: s.title,
      bodyMarkdown: s.bodyMarkdown ?? null,
      conditionYesAction: s.conditionYesAction,
      conditionNoAction: s.conditionNoAction,
      yesLabel: s.yesLabel ?? '예',
      noLabel: s.noLabel ?? '아니오',
    }));
    if (stepRows.length > 0) {
      await db.insert(checklistSteps).values(stepRows);
      stepCreated += stepRows.length;
    }
  }
  console.log(
    `[seed] checklists: ${clCreated}건 신규 (단계 ${stepCreated}) / ${clSkipped}건 스킵 (이미 존재)`,
  );

  console.log('\n[seed] ✅ 완료. 로그인 계정:');
  console.log('       admin@oa.local    / oa1234!  (어드민)');
  console.log('       manager@oa.local  / oa1234!  (매니저)');
  console.log('       hotelier@oa.local / oa1234!  (호텔리어)\n');
}

/**
 * 시드용 TOC 추출 (lib/services/articles.ts의 extractToc과 같은 규칙).
 * 시드 스크립트 단독 실행을 위해 인라인 구현 (server-only import 회피).
 */
function extractTocLocal(markdown: string): TocEntry[] {
  const lines = markdown.split('\n');
  const entries: TocEntry[] = [];
  let inCodeBlock = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;
    const m = /^(#{1,3})\s+(.+?)\s*$/.exec(line);
    if (!m) continue;
    const level = m[1]!.length as 1 | 2 | 3;
    const text = m[2]!.replace(/[*_`~]/g, '').trim();
    if (!text) continue;
    const anchor =
      text
        .toLowerCase()
        .replace(/[^\wㄱ-힝\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .slice(0, 80) || `h-${Math.random().toString(36).slice(2, 8)}`;
    entries.push({ level, text, anchor });
  }
  return entries;
}

main().catch((err) => {
  console.error('[seed] ❌ 실패:', err);
  process.exit(1);
});
