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
import { connectPg } from './connect';
import bcrypt from 'bcryptjs';
import { eq, sql } from 'drizzle-orm';

import {
  businessHolidays,
  businessHoursDefault,
  categories,
  checklistSteps,
  checklists,
  faqs,
  hotels,
  notices,
  notificationTemplates,
  quickReplyTemplates,
  roleStarters,
  serviceStatus,
  solutionLinkPresets,
  menuTaxonomies,
  termGroups,
  termSynonyms,
  ticketChannels,
  ticketMessages,
  tickets,
  users,
  type ChecklistStepAction,
  type NewCategory,
  type NewChecklist,
  type NewChecklistStep,
  type NewFaq,
  type NewHotel,
  type NewNotice,
  type NewNotificationTemplate,
  type NewQuickReplyTemplate,
  type NewRoleStarter,
  type NewServiceStatus,
  type NewSolutionLinkPreset,
  type NewTicket,
  type NewTicketMessage,
  type NewUser,
  type NoticeKind,
  type TicketContactMethod,
  type TicketStatus,
} from './schema';

const DATABASE_URL = process.env.DATABASE_URL ?? '';

async function main() {
  if (!DATABASE_URL || DATABASE_URL.includes('placeholder')) {
    console.error(
      '\n[seed] ❌ DATABASE_URL이 placeholder입니다.\n' +
        '       실제 PostgreSQL 연결 문자열로 교체한 뒤 다시 실행하세요.\n',
    );
    process.exit(1);
  }

  console.log('[seed] DB 연결 중...');
  const { db } = connectPg(DATABASE_URL);

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

  // ─── 6. manager author lookup (notices 등에서 사용) ────────────
  // article 시드는 help.oapms.com 분류 이관 직전 폐기.
  // 신규 아티클은 어드민 UI에서 소분류별로 작성 (별도 작업).
  const [managerRow] = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`${users.email} = 'manager@oa.local'`);
  const authorId = managerRow?.id ?? null;

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

  // ─── 9. tickets + ticket_messages (Phase 5) ─────────────────────
  console.log('[seed] sample 티켓 (Phase 5) 확인...');
  const [hotelierRow] = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`${users.email} = 'hotelier@oa.local'`);
  const [adminUserRow] = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`${users.email} = 'admin@oa.local'`);
  const reporterId = hotelierRow?.id ?? null;
  const managerUserId = managerRow?.id ?? null;
  const adminUserId = adminUserRow?.id ?? null;
  const sampleHotelId = hotelRow?.id ?? null;

  type SeedMessage = {
    /** 작성자 키 — 'hotelier' / 'manager' / 'admin' / null(system) */
    authorKey: 'hotelier' | 'manager' | 'admin' | null;
    kind: 'public' | 'internal_memo' | 'status_change' | 'system';
    content: string;
    metadata?: Record<string, unknown>;
  };
  type SeedTicket = {
    /** AS-YYYY-NNNNNN — 시드는 고정 번호로 idempotency 확보 */
    ticketNo: string;
    productCode: string;
    issueType: string;
    urgency: string;
    impactScope?: string;
    title: string;
    content: string;
    status: TicketStatus;
    channel: 'web' | 'phone' | 'chatbot';
    contactMethods: TicketContactMethod[];
    assignee: 'manager' | 'admin' | null;
    messages: SeedMessage[];
  };

  const year = new Date().getFullYear();
  const seedTickets: SeedTicket[] = [
    {
      ticketNo: `AS-${year}-900001`,
      productCode: 'pms',
      issueType: 'error',
      urgency: 'p2',
      impactScope: 'single_hotel',
      title: 'PMS 룸차트에서 예약 드래그가 안 됩니다',
      content: [
        '## 증상',
        '오전 9시부터 룸차트에서 예약 박스를 드래그하면 1초 정도 후에 원래 위치로 돌아갑니다.',
        '',
        '## 재현 단계',
        '1. PMS 로그인',
        '2. 룸차트 화면 진입',
        '3. 임의의 예약 박스 클릭 후 다른 객실로 드래그',
        '',
        '## 시도해본 것',
        '- 브라우저 캐시 삭제 (Chrome)',
        '- 다른 브라우저 (Edge)로 시도 — 동일 증상',
      ].join('\n'),
      status: 'in_progress',
      channel: 'web',
      contactMethods: ['email', 'sms'],
      assignee: 'manager',
      messages: [
        {
          authorKey: 'manager',
          kind: 'public',
          content:
            '안녕하세요, 룸차트 드래그 이슈 확인했습니다. 다른 단말에서도 같은 증상이 나타나는지 확인 부탁드립니다.',
        },
        {
          authorKey: 'hotelier',
          kind: 'public',
          content:
            '프런트 데스크 PC 2대 모두 동일합니다. 객실 부서 PC에서는 정상 동작합니다.',
        },
        {
          authorKey: 'manager',
          kind: 'internal_memo',
          content:
            '프런트 PC만 영향. 사내 네트워크 분리 정책 + 최근 보안 패치 이후 발생 추정. 인프라팀에 확인 요청.',
        },
      ],
    },
    {
      ticketNo: `AS-${year}-900002`,
      productCode: 'keyless',
      issueType: 'outage',
      urgency: 'p1',
      impactScope: 'all_hotels',
      title: '카드키 발급기 전체 장애',
      content: [
        '## 긴급 장애',
        '체크인 카운터의 카드키 발급기 4대 모두 응답 없음.',
        '체크인 대기 게스트 5팀.',
        '',
        '비상 마스터키로 응대 중이지만 즉시 복구가 필요합니다.',
      ].join('\n'),
      status: 'completed',
      channel: 'phone',
      contactMethods: ['sms'],
      assignee: 'admin',
      messages: [
        {
          authorKey: 'admin',
          kind: 'public',
          content:
            '긴급 출동 시작했습니다. 도착까지 10분 소요 예상. 그동안 비상 마스터키 + 수기 체크인 진행 부탁드립니다.',
        },
        {
          authorKey: 'admin',
          kind: 'internal_memo',
          content:
            'Dev 채널 에스컬 완료 (스레드 ts=fake-1234). 단말 펌웨어 v2.4.1 롤백 + 락 마스터 재동기화.',
        },
        {
          authorKey: 'admin',
          kind: 'public',
          content:
            '발급기 펌웨어 롤백 + 락 마스터 재동기화 완료. 모든 발급기 정상화. 게스트 대기 시간 12분 보상은 매니저 재량으로 조치 부탁드립니다.',
        },
      ],
    },
    {
      ticketNo: `AS-${year}-900003`,
      productCode: 'cms',
      issueType: 'feature_inquiry',
      urgency: 'p3',
      impactScope: 'single_hotel',
      title: 'OTA 부킹닷컴 요금 일괄 변경은 어디서 하나요?',
      content: [
        '여름 성수기를 앞두고 부킹닷컴 요금을 평일 15%, 주말 25% 인상하려고 합니다.',
        '한꺼번에 적용할 수 있는 메뉴가 있을까요? 매일 수동으로 입력하면 너무 오래 걸려서요.',
      ].join('\n'),
      status: 'received',
      channel: 'web',
      contactMethods: ['email'],
      assignee: null,
      messages: [],
    },
  ];

  function resolveAuthorId(key: SeedMessage['authorKey']): string | null {
    if (key === 'hotelier') return reporterId;
    if (key === 'manager') return managerUserId;
    if (key === 'admin') return adminUserId;
    return null;
  }
  function resolveAssigneeId(key: SeedTicket['assignee']): string | null {
    if (key === 'manager') return managerUserId;
    if (key === 'admin') return adminUserId;
    return null;
  }

  let tCreated = 0;
  let tSkipped = 0;
  let mCreated = 0;
  for (const seed of seedTickets) {
    // idempotent: 동일 ticket_no가 있으면 스킵
    const existing = await db
      .select({ id: tickets.id })
      .from(tickets)
      .where(sql`${tickets.ticketNo} = ${seed.ticketNo}`)
      .limit(1);
    if (existing.length > 0) {
      tSkipped++;
      continue;
    }

    const row: NewTicket = {
      ticketNo: seed.ticketNo,
      hotelId: sampleHotelId,
      reporterId,
      productCode: seed.productCode,
      issueType: seed.issueType,
      urgency: seed.urgency,
      impactScope: seed.impactScope ?? null,
      title: seed.title,
      content: seed.content,
      customFields: { seed: true },
      status: seed.status,
      assigneeId: resolveAssigneeId(seed.assignee),
      channel: seed.channel,
      contactMethods: seed.contactMethods,
    };
    const [created] = await db
      .insert(tickets)
      .values(row)
      .returning({ id: tickets.id });
    if (!created) continue;
    tCreated++;

    // 시스템 접수 이벤트 1건은 무조건 첫 메시지로 추가
    const baseMessages: NewTicketMessage[] = [
      {
        ticketId: created.id,
        authorId: reporterId,
        kind: 'system',
        content: '티켓이 접수되었습니다.',
        metadata: { eventKey: 'ticket.received', seed: true },
      },
    ];
    // 상태가 received가 아니면 status_change 자취도 추가
    if (seed.status !== 'received') {
      baseMessages.push({
        ticketId: created.id,
        authorId: resolveAssigneeId(seed.assignee) ?? managerUserId,
        kind: 'status_change',
        content: `접수 → ${seed.status === 'in_progress' ? '처리중' : '완료'}`,
        metadata: { from: 'received', to: seed.status, seed: true },
      });
    }
    for (const m of seed.messages) {
      baseMessages.push({
        ticketId: created.id,
        authorId: resolveAuthorId(m.authorKey),
        kind: m.kind,
        content: m.content,
        metadata: m.metadata ?? {},
      });
    }
    await db.insert(ticketMessages).values(baseMessages);
    mCreated += baseMessages.length;
  }
  console.log(
    `[seed] tickets: ${tCreated}건 신규 (메시지 ${mCreated}) / ${tSkipped}건 스킵`,
  );

  // ─── 10. notices (Phase 7) ──────────────────────────────────────
  console.log('[seed] sample 공지 (Phase 7) 확인...');
  type SeedNotice = {
    kind: NoticeKind;
    productCode: string | null;
    title: string;
    bodyMarkdown: string;
    pinned: boolean;
    banner: boolean;
    /** banner=true일 때 시드 실행 시점 기준 +Nh 후 자동 만료. null이면 무기한 */
    bannerUntilHoursFromNow: number | null;
  };

  const seedNotices: SeedNotice[] = [
    {
      kind: 'notice',
      productCode: null,
      title: '신규 기능 출시 — Self-Search 통합 검색 안내',
      pinned: true,
      banner: false,
      bannerUntilHoursFromNow: null,
      bodyMarkdown: [
        '## 새로워진 통합 검색을 만나보세요',
        '',
        '도움말·FAQ·공지·장애 이력을 한 번에 검색할 수 있는 **Self-Search 통합 검색**이 출시되었습니다.',
        '',
        '## 주요 변경 사항',
        '',
        '- 상단 검색창에서 키워드 입력 → `/search` 에서 4개 탭으로 결과 확인',
        '- 제품 / 정렬(관련도·최신·조회수) 필터 지원',
        '- 결과 없을 때 바로 문의 접수 폼으로 이동',
        '',
        '## 사용 시나리오',
        '',
        '1. 결제 오류 발생 → 검색 "결제 오류" → 관련 가이드/FAQ를 30초 안에 확인',
        '2. 해결되지 않으면 **검색 결과 하단의 "문의 접수" 버튼** 클릭',
        '',
        '문의는 언제든 `/tickets/new`에서 접수해주세요.',
      ].join('\n'),
    },
    {
      kind: 'release',
      productCode: null,
      title: 'v1.1.0 릴리즈 노트 — 이슈 클레임 UX 개선',
      pinned: false,
      banner: false,
      bannerUntilHoursFromNow: null,
      bodyMarkdown: [
        '## v1.1.0 (Phase 5~6)',
        '',
        '이슈 접수와 처리 흐름이 더 빠르고 명확해졌습니다.',
        '',
        '### 새로운 기능',
        '',
        '- **티켓 카드 칸반뷰** — `/admin/tickets/kanban`',
        '  - 드래그앤드롭으로 상태 전이 (received → in_progress → completed)',
        '- **티켓 피드백 위젯** — 완료된 티켓에 호텔리어가 평가/코멘트 가능',
        '- **자동 알림** — 새 티켓 접수 / 긴급도 P1 / Dev 에스컬레이션 시 Slack 채널 자동 전송',
        '- **첨부 파일 업로드** — 티켓 작성 시 스크린샷/로그 첨부 (Vercel Blob)',
        '',
        '### 개선 사항',
        '',
        '- 이메일/SMS 알림 템플릿 통합 (`notification_logs` 추적)',
        '- 접수 폼 검증 강화 (제품·긴급도·영향 범위 필수)',
        '- 모바일 카드뷰 일관성 (티켓 리스트/큐 동일 UI)',
        '',
        '### 다음 릴리즈 예고 (v1.2.0)',
        '',
        '- 공지/업데이트 시스템 (NT-01) — **본 공지가 첫 사례입니다**',
        '- oachat.ai 챗봇 임베드 (CB-01~03)',
      ].join('\n'),
    },
    {
      kind: 'incident',
      productCode: 'pms',
      title: '[해제] 5/27 03:00 PMS 결제 일시 지연 안내',
      pinned: false,
      banner: true,
      bannerUntilHoursFromNow: 6,
      bodyMarkdown: [
        '## 사건 개요',
        '',
        '5월 27일(월) 새벽 03:00 ~ 03:35 (약 35분) 동안 PMS 결제 승인이 평균 8~12초 지연되는 현상이 발생했습니다.',
        '',
        '## 영향 범위',
        '',
        '- 영향: 야간 체크인 6개 호텔 (총 11건 결제)',
        '- 결제 실패: 0건 (모두 재시도 후 정상 승인)',
        '',
        '## 원인',
        '',
        'VAN사(KSNET) 측 정기 점검 중 일부 라우팅 노드의 응답 지연. OA 시스템 내부 이슈는 아니었습니다.',
        '',
        '## 조치',
        '',
        '- 03:35 VAN사 측 자동 복구 확인',
        '- OA 모니터링 알람 설정 보강 — 향후 동일 패턴 발생 시 즉시 매니저에게 알림',
        '',
        '## 향후 대응',
        '',
        '야간 정기 점검(매주 일요일 03:00 ~ 04:00) 시간대에는 자동 재시도 로직이 결제 지연을 보완합니다. 일부 지연이 발생할 수 있는 점 참고해주세요.',
        '',
        '문의: support@oapms.com',
      ].join('\n'),
    },
  ];

  let nCreated = 0;
  let nSkipped = 0;
  for (const n of seedNotices) {
    // idempotent: (kind, title) 중복 시 skip
    const existing = await db
      .select({ id: notices.id })
      .from(notices)
      .where(
        sql`${notices.kind} = ${n.kind} AND ${notices.title} = ${n.title}`,
      )
      .limit(1);
    if (existing.length > 0) {
      nSkipped++;
      continue;
    }
    const bannerUntil =
      n.banner && n.bannerUntilHoursFromNow != null
        ? new Date(Date.now() + n.bannerUntilHoursFromNow * 60 * 60 * 1000)
        : null;
    const row: NewNotice = {
      kind: n.kind,
      productCode: n.productCode,
      title: n.title,
      bodyMarkdown: n.bodyMarkdown,
      pinned: n.pinned,
      banner: n.banner,
      bannerUntil,
      publishedAt: new Date(),
      authorId,
    };
    await db.insert(notices).values(row);
    nCreated++;
  }
  console.log(
    `[seed] notices: ${nCreated}건 신규 / ${nSkipped}건 스킵 (이미 존재)`,
  );

  // ─── 11. notification_templates (Phase 9) ──────────────────────
  console.log('[seed] notification_templates (Phase 9) 확인...');
  type SeedTpl = {
    channel: 'sms' | 'email' | 'slack';
    eventKey: string;
    subject: string | null;
    bodyTemplate: string;
    description: string;
  };
  const seedTemplates: SeedTpl[] = [
    {
      channel: 'email',
      eventKey: 'ticket.received',
      subject: '[OA 통합 AS] 접수 완료 — {{ticket_no}}',
      bodyTemplate:
        '{{reporter_name}}님, 문의가 접수되었습니다.\n티켓 번호: {{ticket_no}}\n제목: {{title}}\n진행상황: {{ticket_url}}',
      description: '신규 티켓 접수 시 호텔리어에게 이메일 발송',
    },
    {
      channel: 'sms',
      eventKey: 'ticket.received',
      subject: null,
      bodyTemplate:
        '[OA 통합 AS] 접수 완료. 티켓 {{ticket_no}}. {{title}} {{ticket_url}}',
      description: '신규 티켓 접수 SMS',
    },
    {
      channel: 'email',
      eventKey: 'ticket.in_progress',
      subject: '[OA 통합 AS] 처리중 — {{ticket_no}}',
      bodyTemplate:
        '{{reporter_name}}님, 티켓 {{ticket_no}}이(가) 처리 단계로 전환되었습니다.\n{{ticket_url}}',
      description: '티켓 처리중 전환 알림',
    },
    {
      channel: 'sms',
      eventKey: 'ticket.in_progress',
      subject: null,
      bodyTemplate:
        '[OA 통합 AS] {{ticket_no}} 처리중. {{title}} {{ticket_url}}',
      description: '티켓 처리중 SMS',
    },
    {
      channel: 'email',
      eventKey: 'ticket.completed',
      subject: '[OA 통합 AS] 처리 완료 — {{ticket_no}}',
      bodyTemplate:
        '{{reporter_name}}님, 티켓 {{ticket_no}}이(가) 완료되었습니다.\n{{ticket_url}}',
      description: '티켓 완료 알림',
    },
    {
      channel: 'sms',
      eventKey: 'ticket.completed',
      subject: null,
      bodyTemplate:
        '[OA 통합 AS] {{ticket_no}} 처리 완료. {{title}} {{ticket_url}}',
      description: '티켓 완료 SMS',
    },
    {
      channel: 'email',
      eventKey: 'account.invite',
      subject: '[OA 통합 AS] {{name}}님, 계정이 생성되었습니다',
      bodyTemplate:
        '{{name}}님, 통합 AS 플랫폼에 초대되었습니다.\n이메일: {{email}}\n임시 비밀번호: {{temp_password}}\n로그인: {{login_url}}\n첫 로그인 후 반드시 비밀번호를 변경해주세요.',
      description: '계정 초대 이메일',
    },
    {
      channel: 'sms',
      eventKey: 'account.invite',
      subject: null,
      bodyTemplate:
        '[OA 통합 AS] {{name}}님 계정 생성. 임시비번: {{temp_password}} (첫 로그인 후 변경) {{login_url}}',
      description: '계정 초대 SMS',
    },
    {
      channel: 'email',
      eventKey: 'account.password_reset',
      subject: '[OA 통합 AS] 비밀번호가 초기화되었습니다',
      bodyTemplate:
        '{{name}}님 비밀번호가 초기화되었습니다.\n임시 비밀번호: {{temp_password}}\n로그인: {{login_url}}\n로그인 후 즉시 변경해주세요.',
      description: '비밀번호 초기화 이메일',
    },
    {
      channel: 'sms',
      eventKey: 'account.password_reset',
      subject: null,
      bodyTemplate:
        '[OA 통합 AS] 비밀번호가 초기화됐어요. 임시비번: {{temp_password}} 로그인 후 즉시 변경 {{login_url}}',
      description: '비밀번호 초기화 SMS',
    },
  ];
  let tplCreated = 0;
  for (const t of seedTemplates) {
    const row: NewNotificationTemplate = {
      channel: t.channel,
      eventKey: t.eventKey,
      subject: t.subject,
      bodyTemplate: t.bodyTemplate,
      description: t.description,
    };
    const ret = await db
      .insert(notificationTemplates)
      .values(row)
      .onConflictDoNothing({
        target: [
          notificationTemplates.channel,
          notificationTemplates.eventKey,
        ],
      })
      .returning({ id: notificationTemplates.id });
    if (ret.length > 0) tplCreated++;
  }
  console.log(
    `[seed] notification_templates: ${tplCreated}건 신규 / ${seedTemplates.length - tplCreated}건 스킵`,
  );

  // ─── 12. (삭제됨 2026-06-09) quick_actions — 마스터DB 재구성으로 DROP ───

  // ─── 13. role_starters (Phase 9) ────────────────────────────────
  console.log('[seed] role_starters (Phase 9) 확인...');
  const seedRoleStarters: NewRoleStarter[] = [
    {
      roleKey: 'front',
      label: '프론트',
      description:
        '체크인·체크아웃·키 발급 등 프론트 데스크 업무 가이드',
      icon: 'BellRing',
      sortOrder: 10,
    },
    {
      roleKey: 'sales',
      label: '예약·판매',
      description: '예약 등록·요금 관리·OTA 연동 가이드',
      icon: 'Briefcase',
      sortOrder: 20,
    },
    {
      roleKey: 'housekeeping',
      label: '하우스키핑',
      description: '객실 정리 상태·동기화·키오스크 가이드',
      icon: 'BedDouble',
      sortOrder: 30,
    },
    {
      roleKey: 'manager',
      label: '관리자',
      description: '직원·권한·매출 리포트 등 호텔 관리자 가이드',
      icon: 'ShieldCheck',
      sortOrder: 40,
    },
    {
      roleKey: 'new_open',
      label: '신규 오픈',
      description: '신규 호텔 오픈 셋업 체크리스트와 초기 설정',
      icon: 'Sparkles',
      sortOrder: 50,
    },
  ];
  let rsCreated = 0;
  for (const rs of seedRoleStarters) {
    const ret = await db
      .insert(roleStarters)
      .values(rs)
      .onConflictDoNothing({ target: roleStarters.roleKey })
      .returning({ id: roleStarters.id });
    if (ret.length > 0) rsCreated++;
  }
  console.log(
    `[seed] role_starters: ${rsCreated}건 신규 / ${seedRoleStarters.length - rsCreated}건 스킵`,
  );

  // ─── 14. (삭제됨 2026-06-09) system_settings 시드 — 미배선 키(max_upload_mb·
  //     rate_limit_login_per_min·slack_channels)는 사문화. 시스템 설정 메뉴 제거됨.
  //     system_settings 테이블은 유지(메뉴 접근 제어 master_menu_manager_access 런타임 저장).

  // ─── 15. quick_reply_templates (Phase 9) ────────────────────────
  console.log('[seed] quick_reply_templates (Phase 9) 확인...');
  const seedQuickReplies: NewQuickReplyTemplate[] = [
    {
      title: '접수 확인 응대',
      content:
        '안녕하세요, 문의 접수 확인했습니다. 운영팀에서 빠르게 확인 후 답변드리겠습니다. 잠시만 기다려주세요.',
      category: '일반',
      sortOrder: 10,
    },
    {
      title: '재현 단계 요청',
      content:
        '확인을 위해 다음 정보가 필요합니다. 1) 발생 시각 2) 사용 단말/브라우저 3) 재현 단계(클릭 순서). 추가로 알려주세요.',
      category: '일반',
      sortOrder: 20,
    },
    {
      title: 'P1 긴급 1차 응대',
      content:
        '긴급 상황 확인했습니다. 즉시 출동/원격 점검 시작합니다. 도착/응답까지 10분 내외 예상되며, 그 사이 비상 대응(예: 비상 마스터키, 수기 체크인)으로 운영 부탁드립니다.',
      category: 'P1',
      sortOrder: 30,
    },
  ];
  let qrCreated = 0;
  let qrSkipped = 0;
  for (const qr of seedQuickReplies) {
    const existing = await db
      .select({ id: quickReplyTemplates.id })
      .from(quickReplyTemplates)
      .where(sql`${quickReplyTemplates.title} = ${qr.title}`)
      .limit(1);
    if (existing.length > 0) {
      qrSkipped++;
      continue;
    }
    await db.insert(quickReplyTemplates).values(qr);
    qrCreated++;
  }
  console.log(
    `[seed] quick_reply_templates: ${qrCreated}건 신규 / ${qrSkipped}건 스킵`,
  );

  // ─── 16. ticket_channels (post-MVP) ────────────────────────────
  console.log('[seed] ticket_channels 확인...');
  const seedTicketChannels = [
    { code: 'web',     label: '웹',       icon: 'Globe',         sortOrder: 10, selectableInAgentForm: false, isAgentDefault: false },
    { code: 'phone',   label: '전화',     icon: 'Phone',         sortOrder: 20, selectableInAgentForm: true,  isAgentDefault: true  },
    { code: 'chatbot', label: '챗봇',     icon: 'Bot',           sortOrder: 30, selectableInAgentForm: false, isAgentDefault: false },
    { code: 'kakao',   label: '카카오톡', icon: 'MessageCircle', sortOrder: 40, selectableInAgentForm: true,  isAgentDefault: false },
    { code: 'email',   label: '이메일',   icon: 'Mail',          sortOrder: 50, selectableInAgentForm: true,  isAgentDefault: false },
    { code: 'walk_in', label: '방문',     icon: 'Footprints',    sortOrder: 60, selectableInAgentForm: true,  isAgentDefault: false },
  ];
  let tcCreated = 0;
  let tcSkipped = 0;
  for (const tc of seedTicketChannels) {
    const existing = await db
      .select({ id: ticketChannels.id })
      .from(ticketChannels)
      .where(sql`${ticketChannels.code} = ${tc.code}`)
      .limit(1);
    if (existing.length > 0) {
      tcSkipped++;
      continue;
    }
    await db.insert(ticketChannels).values(tc);
    tcCreated++;
  }
  console.log(
    `[seed] ticket_channels: ${tcCreated}건 신규 / ${tcSkipped}건 스킵`,
  );

  // ─── 17. term_groups + term_synonyms (synonyms-master) ────────────
  console.log('[seed] term_groups 확인...');

  // categories 조회 — 추천 카테고리 매핑용
  const categoryRows = await db
    .select({ id: categories.id, type: categories.type, code: categories.code })
    .from(categories);
  const catId = (type: string, code: string): string | null => {
    const found = categoryRows.find((r) => r.type === type && r.code === code);
    return found?.id ?? null;
  };

  type SeedGroup = {
    canonicalTerm: string;
    category:
      | 'operation'
      | 'housekeeping'
      | 'fnb'
      | 'frontdesk'
      | 'pms'
      | 'product'
      | 'issue'
      | 'role'
      | 'misc';
    description?: string;
    suggestedCategoryId?: string | null;
    sortOrder: number;
    synonyms: { term: string; language?: 'ko' | 'en' }[];
  };

  const seedGroups: SeedGroup[] = [
    // ── operation (9) ─────────────────────────────────────────
    {
      canonicalTerm: '체크인',
      category: 'operation',
      sortOrder: 110,
      synonyms: [
        { term: 'CI', language: 'en' },
        { term: 'check-in', language: 'en' },
        { term: 'check in', language: 'en' },
        { term: '입실', language: 'ko' },
      ],
    },
    {
      canonicalTerm: '체크아웃',
      category: 'operation',
      sortOrder: 120,
      synonyms: [
        { term: 'CO', language: 'en' },
        { term: 'check-out', language: 'en' },
        { term: 'check out', language: 'en' },
        { term: '퇴실', language: 'ko' },
      ],
    },
    {
      canonicalTerm: '예약',
      category: 'operation',
      sortOrder: 130,
      synonyms: [
        { term: 'reservation', language: 'en' },
        { term: 'booking', language: 'en' },
        { term: '부킹', language: 'ko' },
        { term: '예약건', language: 'ko' },
      ],
    },
    {
      canonicalTerm: '객실',
      category: 'operation',
      sortOrder: 140,
      synonyms: [
        { term: 'room', language: 'en' },
        { term: '룸', language: 'ko' },
        { term: '호실', language: 'ko' },
        { term: '방', language: 'ko' },
      ],
    },
    {
      canonicalTerm: '요금',
      category: 'operation',
      sortOrder: 150,
      synonyms: [
        { term: 'rate', language: 'en' },
        { term: '가격', language: 'ko' },
        { term: '단가', language: 'ko' },
        { term: '요율', language: 'ko' },
      ],
    },
    {
      canonicalTerm: '노쇼',
      category: 'operation',
      sortOrder: 160,
      synonyms: [
        { term: 'no-show', language: 'en' },
        { term: 'no show', language: 'en' },
        { term: 'NS', language: 'en' },
        { term: '미투숙', language: 'ko' },
      ],
    },
    {
      canonicalTerm: '워크인',
      category: 'operation',
      sortOrder: 170,
      synonyms: [
        { term: 'walk-in', language: 'en' },
        { term: 'walk in', language: 'en' },
        { term: 'WI', language: 'en' },
        { term: '현장 투숙', language: 'ko' },
      ],
    },
    {
      canonicalTerm: '얼리 체크인',
      category: 'operation',
      sortOrder: 180,
      synonyms: [
        { term: 'early CI', language: 'en' },
        { term: 'ECI', language: 'en' },
        { term: 'early check-in', language: 'en' },
        { term: '조기 입실', language: 'ko' },
      ],
    },
    {
      canonicalTerm: '레이트 체크아웃',
      category: 'operation',
      sortOrder: 190,
      synonyms: [
        { term: 'late CO', language: 'en' },
        { term: 'LCO', language: 'en' },
        { term: 'late check-out', language: 'en' },
        { term: '늦은 퇴실', language: 'ko' },
      ],
    },

    // ── housekeeping (5) ──────────────────────────────────────
    {
      canonicalTerm: '객실 청소',
      category: 'housekeeping',
      sortOrder: 210,
      synonyms: [
        { term: '하우스키핑', language: 'ko' },
        { term: 'housekeeping', language: 'en' },
        { term: 'HK', language: 'en' },
        { term: '청소', language: 'ko' },
        { term: '룸 클리닝', language: 'ko' },
      ],
    },
    {
      canonicalTerm: '턴다운',
      category: 'housekeeping',
      sortOrder: 220,
      synonyms: [
        { term: 'turn-down', language: 'en' },
        { term: 'turn down', language: 'en' },
        { term: 'TD', language: 'en' },
        { term: '야간정리', language: 'ko' },
      ],
    },
    {
      canonicalTerm: '린넨',
      category: 'housekeeping',
      sortOrder: 230,
      synonyms: [
        { term: 'linen', language: 'en' },
        { term: '침구', language: 'ko' },
        { term: '시트', language: 'ko' },
      ],
    },
    {
      canonicalTerm: '객실 점검',
      category: 'housekeeping',
      sortOrder: 240,
      synonyms: [
        { term: 'inspection', language: 'en' },
        { term: '인스펙션', language: 'ko' },
        { term: '룸체크', language: 'ko' },
        { term: '점검', language: 'ko' },
      ],
    },
    {
      canonicalTerm: '미니바',
      category: 'housekeeping',
      sortOrder: 250,
      synonyms: [
        { term: 'minibar', language: 'en' },
        { term: 'mini bar', language: 'en' },
        { term: 'MB', language: 'en' },
        { term: '미니 바', language: 'ko' },
      ],
    },

    // ── fnb (4) ───────────────────────────────────────────────
    {
      canonicalTerm: '조식',
      category: 'fnb',
      sortOrder: 310,
      synonyms: [
        { term: 'breakfast', language: 'en' },
        { term: 'BF', language: 'en' },
        { term: '아침 식사', language: 'ko' },
        { term: '아침', language: 'ko' },
      ],
    },
    {
      canonicalTerm: '룸서비스',
      category: 'fnb',
      sortOrder: 320,
      synonyms: [
        { term: 'room service', language: 'en' },
        { term: 'RS', language: 'en' },
        { term: '인룸 다이닝', language: 'ko' },
        { term: 'in-room dining', language: 'en' },
      ],
    },
    {
      canonicalTerm: '식음료',
      category: 'fnb',
      sortOrder: 330,
      synonyms: [
        { term: 'F&B', language: 'en' },
        { term: 'FB', language: 'en' },
        { term: 'food and beverage', language: 'en' },
        { term: '에프앤비', language: 'ko' },
      ],
    },
    {
      canonicalTerm: '라운지',
      category: 'fnb',
      sortOrder: 340,
      synonyms: [
        { term: 'lounge', language: 'en' },
        { term: '라운지바', language: 'ko' },
        { term: '라운지 바', language: 'ko' },
      ],
    },

    // ── frontdesk (4) ─────────────────────────────────────────
    {
      canonicalTerm: '프런트',
      category: 'frontdesk',
      sortOrder: 410,
      synonyms: [
        { term: 'FD', language: 'en' },
        { term: 'front desk', language: 'en' },
        { term: '리셉션', language: 'ko' },
        { term: 'reception', language: 'en' },
        { term: '프론트', language: 'ko' },
      ],
    },
    {
      canonicalTerm: '컨시어지',
      category: 'frontdesk',
      sortOrder: 420,
      synonyms: [
        { term: 'concierge', language: 'en' },
        { term: '컨시', language: 'ko' },
      ],
    },
    {
      canonicalTerm: '벨맨',
      category: 'frontdesk',
      sortOrder: 430,
      synonyms: [
        { term: 'bellman', language: 'en' },
        { term: 'bell', language: 'en' },
        { term: '벨보이', language: 'ko' },
        { term: 'bellboy', language: 'en' },
      ],
    },
    {
      canonicalTerm: '게스트',
      category: 'frontdesk',
      sortOrder: 440,
      synonyms: [
        { term: 'guest', language: 'en' },
        { term: '고객', language: 'ko' },
        { term: '손님', language: 'ko' },
        { term: '투숙객', language: 'ko' },
      ],
    },

    // ── pms (6) ───────────────────────────────────────────────
    {
      canonicalTerm: '룸 배정',
      category: 'pms',
      sortOrder: 510,
      synonyms: [
        { term: 'room assignment', language: 'en' },
        { term: '배방', language: 'ko' },
        { term: '배정', language: 'ko' },
        { term: 'assign', language: 'en' },
      ],
    },
    {
      canonicalTerm: '룸 차지',
      category: 'pms',
      sortOrder: 520,
      synonyms: [
        { term: 'room charge', language: 'en' },
        { term: '룸챠지', language: 'ko' },
        { term: '객실 청구', language: 'ko' },
        { term: 'charge', language: 'en' },
      ],
    },
    {
      canonicalTerm: '오버부킹',
      category: 'pms',
      sortOrder: 530,
      synonyms: [
        { term: 'overbooking', language: 'en' },
        { term: 'OB', language: 'en' },
        { term: '초과예약', language: 'ko' },
      ],
    },
    {
      canonicalTerm: '객실 등급',
      category: 'pms',
      sortOrder: 540,
      synonyms: [
        { term: 'room type', language: 'en' },
        { term: 'RT', language: 'en' },
        { term: '룸타입', language: 'ko' },
        { term: '룸 타입', language: 'ko' },
      ],
    },
    {
      canonicalTerm: '점유율',
      category: 'pms',
      sortOrder: 550,
      synonyms: [
        { term: 'occupancy', language: 'en' },
        { term: 'OCC', language: 'en' },
        { term: '객실 점유율', language: 'ko' },
      ],
    },
    {
      canonicalTerm: '객단가',
      category: 'pms',
      sortOrder: 560,
      synonyms: [
        { term: 'ADR', language: 'en' },
        { term: 'average daily rate', language: 'en' },
        { term: '평균 객실 단가', language: 'ko' },
      ],
    },

    // ── product (5) ───────────────────────────────────────────
    {
      canonicalTerm: 'PMS',
      category: 'product',
      suggestedCategoryId: catId('product', 'pms'),
      sortOrder: 610,
      synonyms: [
        { term: 'Property Management System', language: 'en' },
        { term: '자산관리시스템', language: 'ko' },
        { term: 'OA PMS', language: 'en' },
        { term: '피엠에스', language: 'ko' },
      ],
    },
    {
      canonicalTerm: 'CMS',
      category: 'product',
      suggestedCategoryId: catId('product', 'cms'),
      sortOrder: 620,
      synonyms: [
        { term: 'Channel Manager', language: 'en' },
        { term: '채널매니저', language: 'ko' },
        { term: '채널관리시스템', language: 'ko' },
        { term: '씨엠에스', language: 'ko' },
      ],
    },
    {
      canonicalTerm: 'Keyless',
      category: 'product',
      suggestedCategoryId: catId('product', 'keyless'),
      sortOrder: 630,
      synonyms: [
        { term: '키리스', language: 'ko' },
        { term: '모바일키', language: 'ko' },
        { term: 'mobile key', language: 'en' },
        { term: '무인체크인', language: 'ko' },
        { term: '모바일 키', language: 'ko' },
      ],
    },
    {
      canonicalTerm: 'Kiosk',
      category: 'product',
      suggestedCategoryId: catId('product', 'kiosk'),
      sortOrder: 640,
      synonyms: [
        { term: '키오스크', language: 'ko' },
        { term: '무인 단말', language: 'ko' },
        { term: '자율 단말', language: 'ko' },
        { term: 'self check-in kiosk', language: 'en' },
      ],
    },
    {
      canonicalTerm: '웹서비스',
      category: 'product',
      suggestedCategoryId: catId('product', 'web'),
      sortOrder: 650,
      synonyms: [
        { term: 'booking engine', language: 'en' },
        { term: '부킹엔진', language: 'ko' },
        { term: 'BE', language: 'en' },
        { term: '웹 부킹엔진', language: 'ko' },
      ],
    },

    // ── issue (8) ─────────────────────────────────────────────
    {
      canonicalTerm: '결제 실패',
      category: 'issue',
      suggestedCategoryId: catId('issue_type', 'error'),
      sortOrder: 710,
      synonyms: [
        { term: 'payment failed', language: 'en' },
        { term: '결제 오류', language: 'ko' },
        { term: '결제 안됨', language: 'ko' },
        { term: '카드 거절', language: 'ko' },
        { term: '승인 거절', language: 'ko' },
      ],
    },
    {
      canonicalTerm: '네트워크 끊김',
      category: 'issue',
      suggestedCategoryId: catId('issue_type', 'outage'),
      sortOrder: 720,
      synonyms: [
        { term: 'network down', language: 'en' },
        { term: '인터넷 끊김', language: 'ko' },
        { term: '통신 장애', language: 'ko' },
        { term: '망 장애', language: 'ko' },
        { term: '회선 장애', language: 'ko' },
      ],
    },
    {
      canonicalTerm: '카드 미인식',
      category: 'issue',
      suggestedCategoryId: catId('issue_type', 'error'),
      sortOrder: 730,
      synonyms: [
        { term: 'card not detected', language: 'en' },
        { term: '키카드 인식 안됨', language: 'ko' },
        { term: '키 인식 오류', language: 'ko' },
        { term: 'NFC 오류', language: 'ko' },
      ],
    },
    {
      canonicalTerm: '동기화 오류',
      category: 'issue',
      suggestedCategoryId: catId('issue_type', 'error'),
      sortOrder: 740,
      synonyms: [
        { term: 'sync error', language: 'en' },
        { term: '싱크 오류', language: 'ko' },
        { term: '동기화 실패', language: 'ko' },
        { term: 'sync failed', language: 'en' },
      ],
    },
    {
      canonicalTerm: '로그인 안됨',
      category: 'issue',
      suggestedCategoryId: catId('issue_type', 'error'),
      sortOrder: 750,
      synonyms: [
        { term: 'login failed', language: 'en' },
        { term: '로그인 오류', language: 'ko' },
        { term: '로그인 안 됨', language: 'ko' },
        { term: '인증 실패', language: 'ko' },
      ],
    },
    {
      canonicalTerm: '화면 멈춤',
      category: 'issue',
      suggestedCategoryId: catId('issue_type', 'outage'),
      sortOrder: 760,
      synonyms: [
        { term: 'freeze', language: 'en' },
        { term: '멈춤', language: 'ko' },
        { term: '응답 없음', language: 'ko' },
        { term: '다운', language: 'ko' },
        { term: '먹통', language: 'ko' },
      ],
    },
    {
      canonicalTerm: '프린터 오류',
      category: 'issue',
      suggestedCategoryId: catId('issue_type', 'error'),
      sortOrder: 770,
      synonyms: [
        { term: 'printer error', language: 'en' },
        { term: '영수증 안 나옴', language: 'ko' },
        { term: '프린트 안됨', language: 'ko' },
        { term: '출력 안됨', language: 'ko' },
      ],
    },
    {
      canonicalTerm: '데이터 누락',
      category: 'issue',
      suggestedCategoryId: catId('issue_type', 'data_fix'),
      sortOrder: 780,
      synonyms: [
        { term: 'data missing', language: 'en' },
        { term: '누락', language: 'ko' },
        { term: '안 나옴', language: 'ko' },
        { term: '안 보임', language: 'ko' },
      ],
    },

    // ── role (5) ──────────────────────────────────────────────
    {
      canonicalTerm: '매니저',
      category: 'role',
      sortOrder: 810,
      synonyms: [
        { term: 'MGR', language: 'en' },
        { term: 'manager', language: 'en' },
        { term: '책임자', language: 'ko' },
        { term: '매니져', language: 'ko' },
      ],
    },
    {
      canonicalTerm: '객실팀장',
      category: 'role',
      sortOrder: 820,
      synonyms: [
        { term: 'housekeeping manager', language: 'en' },
        { term: 'HKM', language: 'en' },
        { term: '하우스키핑 매니저', language: 'ko' },
        { term: '객실 팀장', language: 'ko' },
      ],
    },
    {
      canonicalTerm: 'F&B 매니저',
      category: 'role',
      sortOrder: 830,
      synonyms: [
        { term: 'FBM', language: 'en' },
        { term: '식음료 매니저', language: 'ko' },
        { term: 'F&B M', language: 'en' },
        { term: '에프앤비 매니저', language: 'ko' },
      ],
    },
    {
      canonicalTerm: '총지배인',
      category: 'role',
      sortOrder: 840,
      synonyms: [
        { term: 'GM', language: 'en' },
        { term: 'general manager', language: 'en' },
        { term: '지배인', language: 'ko' },
        { term: '총괄', language: 'ko' },
      ],
    },
    {
      canonicalTerm: '당직',
      category: 'role',
      sortOrder: 850,
      synonyms: [
        { term: 'duty', language: 'en' },
        { term: 'night manager', language: 'en' },
        { term: '야간 매니저', language: 'ko' },
        { term: 'MOD', language: 'en' },
      ],
    },

    // ── misc (4) ──────────────────────────────────────────────
    {
      canonicalTerm: 'VIP',
      category: 'misc',
      sortOrder: 910,
      synonyms: [
        { term: '브이아이피', language: 'ko' },
        { term: '귀빈', language: 'ko' },
        { term: 'VIP 게스트', language: 'en' },
      ],
    },
    {
      canonicalTerm: '블록',
      category: 'misc',
      sortOrder: 920,
      synonyms: [
        { term: 'block', language: 'en' },
        { term: '단체 블록', language: 'ko' },
        { term: 'group block', language: 'en' },
        { term: '단체예약', language: 'ko' },
      ],
    },
    {
      canonicalTerm: 'OOO',
      category: 'misc',
      sortOrder: 930,
      synonyms: [
        { term: 'out of order', language: 'en' },
        { term: '사용불가 객실', language: 'ko' },
        { term: '수리중 객실', language: 'ko' },
      ],
    },
    {
      canonicalTerm: 'OS',
      category: 'misc',
      sortOrder: 940,
      synonyms: [
        { term: 'out of service', language: 'en' },
        { term: '일시 정지 객실', language: 'ko' },
      ],
    },
  ];

  let tgCreated = 0;
  let tgSkipped = 0;
  let tsCreated = 0;
  for (const g of seedGroups) {
    const existing = await db
      .select({ id: termGroups.id })
      .from(termGroups)
      .where(sql`${termGroups.canonicalTerm} = ${g.canonicalTerm}`)
      .limit(1);

    let groupId: string;
    if (existing.length > 0) {
      tgSkipped++;
      groupId = existing[0]!.id;
    } else {
      const [inserted] = await db
        .insert(termGroups)
        .values({
          canonicalTerm: g.canonicalTerm,
          category: g.category,
          description: g.description ?? null,
          suggestedCategoryId: g.suggestedCategoryId ?? null,
          sortOrder: g.sortOrder,
        })
        .returning({ id: termGroups.id });
      groupId = inserted!.id;
      tgCreated++;
    }

    // 동의어 INSERT (중복은 unique 인덱스로 차단 → onConflict)
    let synSortOrder = 10;
    for (const syn of g.synonyms) {
      try {
        await db
          .insert(termSynonyms)
          .values({
            groupId,
            term: syn.term,
            language: syn.language ?? 'ko',
            sortOrder: synSortOrder,
          })
          .onConflictDoNothing({
            target: [
              termSynonyms.groupId,
              termSynonyms.term,
              termSynonyms.language,
            ],
          });
        tsCreated++;
        synSortOrder += 10;
      } catch (err) {
        console.warn(
          `[seed] term_synonyms 삽입 실패 (${g.canonicalTerm} / ${syn.term}):`,
          err instanceof Error ? err.message : err,
        );
      }
    }
  }
  console.log(
    `[seed] term_groups: ${tgCreated}건 신규 / ${tgSkipped}건 스킵, term_synonyms: ${tsCreated}건 INSERT 시도`,
  );

  // ───────────────────────────────────────────────────────────────
  // 메뉴 구조 마스터 시드 (아티클 menu_path 정본)
  // 6개 제품 × 평균 2~3 루트 × 평균 3~4 자식 ≈ 50~60개 노드
  // 멱등성: (product_code, parent_id, label) 유니크 인덱스에 onConflictDoNothing
  // ───────────────────────────────────────────────────────────────

  type MenuSeedNode = {
    label: string;
    description?: string;
    children?: MenuSeedNode[];
  };
  type MenuSeedProduct = {
    productCode: string;
    roots: MenuSeedNode[];
  };

  // help.oapms.com (Channel Talk Help Center) 분류 트리에서 이관.
  // - 대분류 = productCode (categories 테이블의 product 타입)
  // - 중분류 = root (parent_id IS NULL)
  // - 소분류 = child (parent_id = root.id)
  // FAQ 카테고리는 제외, "OA " 접두사는 대분류에서만 제거(중분류는 실제 메뉴명 그대로).
  const seedMenu: MenuSeedProduct[] = [
    {
      productCode: 'pms',
      roots: [
        {
          label: '객실관리',
          children: [
            { label: '실시간 객실(오늘)' },
            { label: '객실현황(이달)' },
            { label: '예약등록' },
            { label: '예약조회' },
            { label: '예약 캘린더' },
            { label: '체크인/아웃' },
            { label: '객실매출 상세조회' },
            { label: '체크인/아웃 조회' },
            { label: '객실재고 (타입별)' },
            { label: '객실재고 (일자별)' },
            { label: '객실예약금' },
            { label: '미결산 내역' },
            { label: '객실식사인원조회' },
            { label: '분실물 관리' },
          ],
        },
        {
          label: '고객관리',
          children: [
            { label: '고객정보 등록' },
            { label: '고객정보 조회' },
          ],
        },
        {
          label: '객실 일마감',
          children: [
            { label: '일마감 사전체크' },
            { label: '일마감' },
          ],
        },
        {
          label: '보고서',
          children: [
            { label: 'Daily Report' },
            { label: 'Sales Report' },
            { label: 'Sales Statistics' },
            { label: 'Daily Morning Report' },
            { label: 'Forecast' },
            { label: '입금 상세 조회' },
            { label: '객실별 잔액 현황' },
            { label: '대외후불 관리' },
            { label: '일별 매출 리스트' },
            { label: '매출 상세 리스트' },
            { label: '유형별 매출집계' },
            { label: '거래처별 매출집계' },
            { label: '객실별 매출집계' },
          ],
        },
      ],
    },
    {
      productCode: 'cms',
      roots: [
        {
          label: 'HG CMS',
          children: [
            { label: 'HG CMS 접속 방법' },
            { label: '[OTA] 채널 별 CMS 설정 방법' },
            { label: '[CMS] HG CMS 연동 방법' },
            { label: '[PMS] HG CMS 연동 방법' },
          ],
        },
        {
          label: 'TL LINCOLN CMS',
          children: [{ label: 'TL LINCOLN CMS 연동 방법' }],
        },
        {
          label: 'OA 홈페이지 & 부킹엔진',
          children: [
            { label: '홈페이지 예약 및 결제 과정' },
            { label: '홈페이지 예약취소 및 환불' },
            { label: '홈페이지 예약관리' },
            { label: '객실 상품 및 가격' },
            { label: '객실 타입 및 재고' },
            { label: '지점 정보/관리' },
            { label: '홈페이지 관리자 페이지' },
          ],
        },
      ],
    },
    {
      productCode: 'keyless',
      roots: [
        {
          label: 'OA 키리스',
          children: [
            { label: '객실 제어' },
            { label: '도어락 관리' },
            { label: '미처리 관리' },
            { label: '모바일키 사용 가이드' },
          ],
        },
        {
          label: 'OA 도어락',
          children: [
            { label: '저전력모듈 세팅 어플(APP) & AP 설정' },
            { label: '도어락 초기화 설정(하이원 제품 기준)' },
            { label: '카드키 발급/조회' },
          ],
        },
      ],
    },
    {
      productCode: 'kiosk',
      roots: [
        {
          label: 'OA 키오스크',
          children: [
            { label: '예약 고객 키오스크 체크인 방법' },
            { label: '미예약 (워크인) 고객 키오스크 체크인 방법' },
            { label: '키오스크 객실 이미지 변경' },
            { label: '키오스크 판매 가격 변경' },
          ],
        },
      ],
    },
    {
      productCode: 'web',
      roots: [
        {
          label: 'OA 메시지',
          children: [
            { label: 'SMS 전송' },
            { label: 'SMS 전송내역' },
            { label: 'SMS 샘플관리(OA)' },
            { label: 'SMS 샘플관리(EON)' },
            { label: '알림톡 채널등록 방법' },
            { label: '알림톡 전송' },
            { label: '알림톡 템플릿관리' },
          ],
        },
        {
          label: 'OA 게시판',
          children: [{ label: '게시판 작성하기' }],
        },
        {
          label: 'OA 하우스키퍼',
          children: [
            { label: '프론트' },
            { label: '매니저' },
            { label: '객실' },
            { label: '관리자' },
          ],
        },
        {
          label: 'OA 웹POS',
          children: [
            { label: 'POS 설정' },
            { label: '주문하기' },
            { label: '결제' },
            { label: '보고서' },
            { label: '마감' },
          ],
        },
        {
          label: 'OA 스마트 TV',
          children: [{ label: 'OA 스마트 TV' }],
        },
      ],
    },
    {
      productCode: 'config',
      roots: [
        {
          label: '공통설정',
          children: [
            { label: '거래처 설정' },
            { label: '게시판 설정' },
          ],
        },
        {
          label: '객실설정',
          children: [
            { label: '객실단가설정' },
            { label: '객실요금설정' },
            { label: '객실수리등록' },
          ],
        },
      ],
    },
  ];

  let menuCreated = 0;
  let menuSkipped = 0;
  for (const product of seedMenu) {
    let rootOrder = 100;
    for (const root of product.roots) {
      const existingRoot = await db
        .select({ id: menuTaxonomies.id })
        .from(menuTaxonomies)
        .where(
          sql`${menuTaxonomies.productCode} = ${product.productCode} AND ${menuTaxonomies.parentId} IS NULL AND ${menuTaxonomies.label} = ${root.label}`,
        )
        .limit(1);

      let rootId: string;
      if (existingRoot.length > 0) {
        menuSkipped++;
        rootId = existingRoot[0]!.id;
      } else {
        const [inserted] = await db
          .insert(menuTaxonomies)
          .values({
            productCode: product.productCode,
            parentId: null,
            label: root.label,
            description: root.description ?? null,
            sortOrder: rootOrder,
          })
          .returning({ id: menuTaxonomies.id });
        rootId = inserted!.id;
        menuCreated++;
      }
      rootOrder += 100;

      let childOrder = 100;
      for (const child of root.children ?? []) {
        const existingChild = await db
          .select({ id: menuTaxonomies.id })
          .from(menuTaxonomies)
          .where(
            sql`${menuTaxonomies.productCode} = ${product.productCode} AND ${menuTaxonomies.parentId} = ${rootId} AND ${menuTaxonomies.label} = ${child.label}`,
          )
          .limit(1);
        if (existingChild.length > 0) {
          menuSkipped++;
        } else {
          await db.insert(menuTaxonomies).values({
            productCode: product.productCode,
            parentId: rootId,
            label: child.label,
            description: child.description ?? null,
            sortOrder: childOrder,
          });
          menuCreated++;
        }
        childOrder += 100;
      }
    }
  }
  console.log(
    `[seed] menu_taxonomies: ${menuCreated}건 신규 / ${menuSkipped}건 스킵`,
  );

  // ─── N. 운영시간 마스터 (P1 선행 — 호텔리어 컨택 패널 의존) ──────
  console.log('[seed] business_hours_default 확인...');
  const existingBhd = await db
    .select({ id: businessHoursDefault.id })
    .from(businessHoursDefault)
    .where(eq(businessHoursDefault.isActive, true))
    .limit(1);

  const CONTACT_DEFAULTS = {
    mainPhone: '1833-4702',
    mainEmail: 'as@oapms.com',
    arsItems: [
      { num: '1', label: '시스템 문의' },
      { num: '2', label: '도입 상담' },
      { num: '3', label: '회계·기타' },
    ],
    faxNumber: '0505-300-4702',
    websiteUrl: 'www.oapms.com',
    stateIcons: {
      open: 'Headset',
      lunch: 'Coffee',
      intake_closed: 'CircleAlert',
      closed: 'DoorClosed',
    },
  };

  if (existingBhd.length === 0) {
    await db.insert(businessHoursDefault).values({
      weekdayOpen: '10:00',
      weekdayClose: '18:40',
      lunchStart: '12:00',
      lunchEnd: '13:00',
      intakeDeadline: '18:00',
      saturdayClosed: true,
      sundayClosed: true,
      holidaysClosed: true,
      emergencyPhone: '070-8028-0919',
      emergencyNote: '운영시간 외 긴급전화 (단순 금액 정정 불가)',
      timezone: 'Asia/Seoul',
      ...CONTACT_DEFAULTS,
    });
    console.log('[seed] business_hours_default: 1건 신규 (연락처 포함)');
  } else {
    // 연락처 컬럼이 NULL이면 보강 (P3 정리에서 컬럼 추가됨, 2026-05-30)
    const row = existingBhd[0]!;
    const [current] = await db
      .select({
        mainPhone: businessHoursDefault.mainPhone,
        mainEmail: businessHoursDefault.mainEmail,
        arsItems: businessHoursDefault.arsItems,
      })
      .from(businessHoursDefault)
      .where(eq(businessHoursDefault.id, row.id))
      .limit(1);
    if (current && !current.mainPhone) {
      await db
        .update(businessHoursDefault)
        .set(CONTACT_DEFAULTS)
        .where(eq(businessHoursDefault.id, row.id));
      console.log('[seed] business_hours_default: 연락처 컬럼 보강');
    } else {
      console.log('[seed] business_hours_default: 이미 존재 (연락처 포함), 스킵');
    }
  }

  // ─── N+1. 공휴일 마스터 (2026년 19종 = 양력 8 + 음력 7 + 대체 4) ──
  const HOLIDAYS_2026: {
    date: string;
    name: string;
    isRecurring: boolean;
  }[] = [
    // 양력 — is_recurring=true (UI에서 "내년 복제" 대상 표시)
    { date: '2026-01-01', name: '신정', isRecurring: true },
    { date: '2026-03-01', name: '삼일절', isRecurring: true },
    { date: '2026-05-05', name: '어린이날', isRecurring: true },
    { date: '2026-06-06', name: '현충일', isRecurring: true },
    { date: '2026-08-15', name: '광복절', isRecurring: true },
    { date: '2026-10-03', name: '개천절', isRecurring: true },
    { date: '2026-10-09', name: '한글날', isRecurring: true },
    { date: '2026-12-25', name: '성탄절', isRecurring: true },
    // 음력 — 2026년 천문연 기준 (매년 수동 등록 필요)
    { date: '2026-02-16', name: '설날 연휴', isRecurring: false },
    { date: '2026-02-17', name: '설날', isRecurring: false },
    { date: '2026-02-18', name: '설날 연휴', isRecurring: false },
    { date: '2026-05-24', name: '부처님오신날', isRecurring: false },
    { date: '2026-09-24', name: '추석 연휴', isRecurring: false },
    { date: '2026-09-25', name: '추석', isRecurring: false },
    { date: '2026-09-26', name: '추석 연휴', isRecurring: false },
    // 대체공휴일 — 2026 한정 (현충일·금요일 한글날·성탄절은 대체 대상 아님)
    { date: '2026-03-02', name: '삼일절 대체공휴일', isRecurring: false },
    { date: '2026-05-25', name: '부처님오신날 대체공휴일', isRecurring: false },
    { date: '2026-08-17', name: '광복절 대체공휴일', isRecurring: false },
    { date: '2026-10-05', name: '개천절 대체공휴일', isRecurring: false },
  ];

  console.log(
    `[seed] business_holidays 확인 ${HOLIDAYS_2026.length}건...`,
  );
  let bhCreated = 0;
  let bhSkipped = 0;
  for (const h of HOLIDAYS_2026) {
    const existing = await db
      .select({ id: businessHolidays.id })
      .from(businessHolidays)
      .where(
        sql`${businessHolidays.date} = ${h.date} AND ${businessHolidays.isActive} = true`,
      )
      .limit(1);
    if (existing.length === 0) {
      await db.insert(businessHolidays).values(h);
      bhCreated++;
    } else {
      bhSkipped++;
    }
  }
  console.log(
    `[seed] business_holidays: ${bhCreated}건 신규 / ${bhSkipped}건 스킵`,
  );

  console.log('\n[seed] ✅ 완료. 로그인 계정:');
  console.log('       admin@oa.local    / oa1234!  (어드민)');
  console.log('       manager@oa.local  / oa1234!  (매니저)');
  console.log('       hotelier@oa.local / oa1234!  (호텔리어)\n');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[seed] ❌ 실패:', err);
    process.exit(1);
  });
