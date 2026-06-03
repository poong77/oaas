/**
 * 일회성 시드 — role_starters 역할별 아티클 + FAQ 매핑 큐레이션.
 *
 * 실행: npx tsx db/seed-role-starter-mappings.ts
 *   - DATABASE_URL 필요 (.env.local / .env).
 *   - 발행(published+active) 아티클 + 활성 FAQ만 선별해 roleKey별
 *     articleIds·faqIds(순서 보존)를 설정.
 *   - 멱등: roleKey별 articleIds/faqIds 덮어쓰기만 (이력/다른 컬럼 영향 없음).
 *   - 어드민(/admin/master/role-starters)에서 언제든 재편집 가능.
 *
 * 큐레이션 원칙:
 *   - 역할 시작점 = "전량 노출"이 아니라 그 역할이 가장 먼저 볼 핵심 묶음.
 *   - 아티클(가이드) = 따라하기/개요 / FAQ = 자주 막히는 질문·트러블.
 *   - 온보딩 흐름 순서대로 정렬.
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { and, eq, inArray } from 'drizzle-orm';

import { articles, faqs, roleStarters } from './schema';

/** roleKey → 노출 순서대로의 article id 배열. */
const ARTICLE_MAPPING: Record<string, string[]> = {
  // 프론트 — 체크인/아웃·빌이체·키 발급·키오스크 데스크
  front: [
    '9180391e-1a75-4dd7-a132-876139d1ada4', // 체크인/아웃 화면·빌이체 개요
    '29924c45-2ec6-4721-b1e9-317800d93bd4', // 체크인·체크아웃·매출/입금 처리
    'e73ae59f-4034-466a-b076-2e0b62e2d300', // 검색 필터로 예약 찾고 빠르게 체크인
    'ff3d92c9-5074-4114-b4a2-0960da9da700', // 체크인/아웃 조회 6대 액션
    '9bf6ba7c-1c60-42a9-b18b-7f7ecfb9103d', // 빌이체 처리
    '2dedf924-d019-4690-9582-033ecc615365', // 미결산 내역 체크아웃
    '4fbd204e-9dda-45be-bb55-37f6856dac8c', // 실시간 객실(오늘) 상태 변경
    'cdb2991d-aa16-490e-aa93-09f796911abc', // 체크인 이력 SMS·알림톡
    '0088adf0-ca03-4213-ac0e-8eae95e3b130', // 카드키 종류와 발급 절차
    'aaff9275-176f-4f2c-b3fc-fa62746611ec', // 객실 상세·키 발급
    '8c642728-49c0-4143-afab-6236e41d4457', // 모바일키 3단계 사용
    '913895e7-9639-4da6-b575-8ef422295d3e', // 예약 고객 키오스크 체크인 4단계
    '718d9262-46cd-4660-a0c8-2a85ec60b667', // 예약 고객 키오스크 체크인 프로세스
    '5e667152-eb54-4ec0-9f01-84629db2ed21', // 워크인 키오스크 체크인 9단계
    'cf83d5c7-5c73-45bb-89cc-245839aada22', // 키오스크 전체화면 F12
    '4fb6857a-6038-455c-9137-c6b6bd3af57b', // 분실물 등록~인수
  ],
  // 예약·판매 — 예약 등록·요금/재고·OTA/CMS·홈페이지
  sales: [
    'c219a9a6-4266-4b79-a6ce-14dd2934d18e', // 예약등록 5대 기능 개요
    'bae6c3a2-4699-4c64-abd5-56887623a11b', // 예약 생성·일별 요금·조식·단체
    '26d19ddd-3b80-45b0-86ba-d05a75b8c098', // 예약금 등록·처리
    '509d78f5-1d13-4d48-8d1d-dbf824e6bd5c', // 예약조회 화면·필터
    'eb30e4b7-1ac0-4e5c-88da-55f5f3098223', // 예약 캘린더 화면 구성
    'f5221aa5-ed9d-42e9-82db-a4ccb552711f', // 월별 예약 캘린더 파악
    'e61a9dd2-7635-498c-8a58-dfc57949b6c1', // 객실요금설정
    'b377f4a3-f803-45d5-b861-02d57841d47a', // 객실단가설정 Rack rate
    '5456f117-a315-4bab-9e53-3e557aafa85f', // 객실재고(일자별) 활용
    '7db5f92c-2062-410d-b130-83fe0582a884', // OTA 채널별 CMS 연동 개요
    'b5279a5c-507c-4400-b56c-f1318700d4ff', // OTA 채널별 CMS 단계별 설정
    '877a88d0-6f8c-4ca6-8c6f-938109203003', // HG CMS 채널 추가·요금제·재고
    '8b822bce-cf91-412f-a097-096152374fbc', // HG CMS 객실타입·채널 매핑
    'ad55d0bc-ca1e-43a0-a21a-a5da127032e4', // 객실 상품 등록·가격 관리
    'af0f9b12-68d1-4f2c-a1d1-a22cf376d7aa', // 객실 상품 등록·가격 일괄 수정
    '7d761324-8f9e-47ac-a0f4-dc064fb92e41', // 홈페이지 예약관리 화면
    'b650e92e-2099-4a92-a14d-572667ee3f02', // 홈페이지 예약취소·환불 흐름
  ],
  // 하우스키핑 — 객실 상태·하우스키퍼 앱·도어락 메이드키
  housekeeping: [
    '6bede0db-00ab-4545-86ed-cc2f1e49f03d', // 실시간 객실(오늘) 화면 구성
    '4fbd204e-9dda-45be-bb55-37f6856dac8c', // 실시간 객실(오늘) 상태 변경
    '94572f26-0872-410f-a50b-46a8e77a5322', // 객실현황(이달) 청소 상태 관리
    '321ac631-56c1-45fb-8114-bb25c5281ef6', // 객실현황(이달) 화면 구성
    'e5ab5217-64a1-4d7b-b236-73208499e1f5', // 객실에서 청소요청·룸서비스
    'd6d70ed3-fce6-41f4-8e18-365d5b8aa6cf', // 프론트에서 청소·룸서비스·분실물
    '3e80aa7b-295f-49b6-abfb-ad0ab43aeb1b', // 매니저 앱 청소관리 시스템
    'b0dd054c-467e-4963-8852-66f1b0c73e84', // 매니저 앱 청소완료 처리
    '17e80de7-ba91-4d95-8cd5-dc0c1dab657c', // 하우스키퍼 관리자 환경설정
    'c33cf117-2201-4239-8dea-fc7dd7bb909c', // 청소요청(폰키) 상태 안 보일 때
    '43898a67-4789-4293-a949-242ffede399e', // 메이드·마스터 비밀번호 설정
    'd4501274-f3e3-4b17-9dd6-ed50b6771ca9', // 도어락 관리 화면 구성
    '54589797-5710-46cc-aac2-19d2a82e7abe', // 키오스크 객실 이미지 변경
    '184cf326-7264-49bf-9da8-8b4f8fc1726d', // 분실물 관리 3단계
  ],
  // 관리자 — 매출 리포트·일마감·거래처
  manager: [
    '7827be85-f63c-4041-91f7-8975f9aafaba', // Daily Report 다운로드
    '51677835-9d78-4b60-9366-5985417f3b1a', // Daily Report 화면·매출 분류
    '885732c1-ea6f-41d4-a2de-d94158ee5e4f', // Daily Morning Report
    '2a6df01c-bf1b-4664-8e1b-7fc3a93a6cd1', // Sales Report 판매 지표
    'acd536e4-8a21-4cbb-92a5-ac6062cc088d', // Sales Report 조회·다운로드
    '4ad5c84e-77a9-4ac4-9c6a-c460d6c45fee', // 판매통계 조회
    '39a21219-287f-47ca-bcc6-eba81c570b96', // Forecast 예측 지표
    '24cc311c-1bdc-42da-8c27-07af17067e91', // 일별 매출 리스트
    '2c9ba218-620d-4448-a958-438e9ee04271', // 매출 상세 리스트 조회·다운로드
    '58a2e895-ccbf-47ea-85f7-a70097759d46', // 객실별 매출집계
    '60384c16-abeb-4940-8664-107eb63b9365', // 거래처별 매출집계 화면
    'e62aa6c9-4855-44e2-9115-8db48d05e069', // 거래처별 매출 분석
    'd451da12-5f8e-4b25-906d-ed1798165bae', // 유형별 매출 분석 의사결정
    'fa41f07c-1550-4f3e-bdd3-1d0e4d08aa51', // 일마감 화면 구성·영업일자
    '0f94071b-f8f2-4223-a12c-17086e081583', // 일마감 안전하게 처리
    '967c3a67-9977-433a-943f-e18be86f3343', // 일마감 사전체크
    '61fbae28-48c3-4dca-be1e-971fe4548785', // 거래처 설정
  ],
  // 신규 오픈 — 초기 셋업(CMS 접속·채널/객실 매핑·요금·도어락·메시지)
  new_open: [
    'c072a3b4-e69c-4f27-9fa1-4c17a34dfdd2', // HG CMS 2단계 인증 접속
    '0e5b950a-ad20-4087-97e2-15472215af72', // HG CMS 접속 방법
    '877a88d0-6f8c-4ca6-8c6f-938109203003', // HG CMS 채널 추가·요금제·재고
    '8b822bce-cf91-412f-a097-096152374fbc', // HG CMS 객실타입·채널 매핑
    'd16c0b18-f7ea-4abe-ad7a-cd0982bdbfe6', // 객실 타입 등록 + PMS 매핑
    'b377f4a3-f803-45d5-b861-02d57841d47a', // 객실단가설정
    'e61a9dd2-7635-498c-8a58-dfc57949b6c1', // 객실요금설정
    'f3ab9a27-8559-48e6-bbd6-2838342d2a39', // 지점 정보·연락처·좌표
    'e36a0877-3a34-4fd8-9a46-e83a9dbfc02f', // 신규 객실·시설 페이지 등록
    '22e0166e-709e-48ce-9002-933219d84fb1', // 홈페이지 관리자 페이지 주요 영역
    'ad55d0bc-ca1e-43a0-a21a-a5da127032e4', // 객실 상품 등록·가격 관리
    '69803b39-4146-4753-8e26-3223a1a9b666', // 하이원 도어락 초기화
    '0bb6c8a4-23dd-428e-8d58-78fab22ad773', // 저전력모듈 세팅 앱 설치·AP
    '65f2c4e1-64d6-4a3b-832d-3c5d0bf0a625', // CP210x 드라이버 설치·단말기
    '0088adf0-ca03-4213-ac0e-8eae95e3b130', // 카드키 종류와 발급 절차
    'abfb34f9-e3e1-4b6a-9e3a-5c96b1e2f703', // 알림톡 채널 등록 5단계
    '5b9266b5-ebfd-4edc-a1a5-012ce249e5b3', // SMS 템플릿 작성·발송 4단계
    '2329bb6c-7385-4a26-a345-eaaa00b3eb39', // 웹POS 초기 설정
  ],
};

/** roleKey → 노출 순서대로의 faq id 배열. */
const FAQ_MAPPING: Record<string, string[]> = {
  front: [
    '55173f46-3578-4cce-a2a8-09ed4a743dbc', // 폰키 발급이 안돼요
    'c2945560-7500-4ddb-8ec3-93d009c30ce7', // 폰키로 문 안 열릴 때 임시 해결
    '094ecfa9-d66d-4fa1-a059-a5c288f79c1e', // 마스터 비밀번호로 문이 안 열림
    '1182c21e-d4f3-4c06-b699-ec66def99cc6', // 키오스크 카드 결제 안 됨 (긴급)
    '782de678-6ceb-4b9d-93d5-05f1f2e9d40a', // 키오스크 완전 먹통
    '01e2177a-74bb-4970-bd84-d9d036d45a91', // 키오스크 영수증 추가 구매
    'ebff3d8d-32bc-4bc5-a0fb-db0ce647c687', // 체크인/아웃 날짜 변경
    '1646592a-d182-4cef-9e9d-5c5a32903f00', // TODAY 기능 잘 쓰고 싶어요
  ],
  sales: [
    '59729ec3-0b5d-460d-8683-aa5eb387980c', // 요금 관리는 어떻게 하나요?
    '74b8632b-fab9-4137-a294-0c51b0e957ee', // 노쇼 처리는 어떻게 하나요?
    '81a00138-2a04-4f51-afc2-7d60e0fae601', // 특정 OTA에만 재고를 닫을 수 있나요?
    'fdecfc77-af96-4f9e-8e48-f87bde922653', // 재고 재계산은 어떻게 하나요?
    'd0b303e8-5424-4d9d-b7e7-4ce95a782cc1', // OTA 예약이 PMS에 안 들어오면 확인
    '4c02f51e-cbed-454c-bfe2-d4aa8ef704e8', // 부킹엔진 예약 위약금 없이 취소?
    '53b8cbbc-540e-46ca-8a68-66157400a47f', // 홈페이지 재고 0이면 예약 막히나요?
    '2d994314-e87d-4c72-9795-bc9427518126', // 홈페이지 예약 수수료는 얼마인가요?
  ],
  housekeeping: [
    'c30bb589-3022-4cf8-96ce-98a588fd3c97', // 도어락 비밀번호 직접 변경
    '6ba0711d-25cf-4532-b4fa-4c4fdc88892d', // 도어락이 '연결시도중'으로 뜸
    '094ecfa9-d66d-4fa1-a059-a5c288f79c1e', // 마스터 비밀번호로 문이 안 열림
    '13076298-bcde-4325-aaa7-1f5a09bfb008', // 신규 객실 기본 상태(공실/미정비)
    '02da3ff0-44d9-4bdc-8be5-3b80e4fd01cb', // 특정 호실 미사용(OOO) 처리
    '51b99dc6-1830-4f28-90a1-d50e1700273b', // 객실현황(이달) 화면이 안보여요
  ],
  manager: [
    '45682f4e-c97e-4b5a-9c06-304d3c36906b', // 매출을 잘못 입력했어요
    '5476e721-f594-494e-8890-cea0786001f5', // 일마감 후에도 매출 수정 가능?
    '7e969242-d7c2-4de1-a5f5-63060190cc29', // 재마감은 직접 할 수 있나요?
    '1ba1077e-cc1f-4b9a-ac0e-d2f0bf572cc9', // 일마감 후 수정 → 재마감 요청
    '0f3fd7cc-3a9b-471e-b94f-76f301b59fb4', // 포캐스트와 영업일보 숫자 다름
    '1e28c68b-3120-4b47-9b31-9c32ec6f9130', // 신규 직원 PMS ID 추가
    'c7aec69c-8c3a-464b-bf30-4be7cd6ac8fc', // 계정 권한을 변경해 주세요
    '3a2c254f-6d5a-415a-9217-c6cd5d7f2843', // 매출 수정 무상 건수
  ],
  new_open: [
    '1e28c68b-3120-4b47-9b31-9c32ec6f9130', // 신규 직원 PMS ID 추가
    '75de821a-65ed-4b9c-9999-f378b1b4a575', // 신규 직원 PMS 아이디 발급
    'ff22d875-beea-48b0-b910-2818248f64e4', // 초기 비밀번호는 무엇인가요?
    'c0576d70-b3f9-4dd5-ac29-502a9b2bfb67', // 새 객실 타입을 추가해 주세요
    '13076298-bcde-4325-aaa7-1f5a09bfb008', // 신규 객실 기본 상태(공실/미정비)
    'c7039fa0-3bdc-4c03-8b0d-24fd325680e8', // 신규 객실 타입을 OTA와 매핑
    '23021d18-eaa0-429b-ab59-a852132de031', // 신규 도어락 설치 후 PMS 연동 안됨
    '08fb1bcb-8766-4a10-8f41-4aea2efa360d', // AS 사이트 계정 정보 분실
    '8fa78993-ca9f-471f-a9dc-b1bb2f588f9f', // 헬프센터에 없는 내용 문의처
  ],
};

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL 없음');
  const db = drizzle(neon(url));

  // 1) 발행 아티클 검증
  const allArticleIds = [...new Set(Object.values(ARTICLE_MAPPING).flat())];
  const validArticles = await db
    .select({ id: articles.id })
    .from(articles)
    .where(
      and(
        inArray(articles.id, allArticleIds),
        eq(articles.status, 'published'),
        eq(articles.isActive, true),
      ),
    );
  const articleSet = new Set(validArticles.map((r) => r.id));
  const missingArticles = allArticleIds.filter((id) => !articleSet.has(id));
  if (missingArticles.length) {
    console.warn(`⚠️ 발행 아닌 article ${missingArticles.length}건 (제외):`);
    missingArticles.forEach((id) => console.warn(`   - ${id}`));
  }

  // 2) 활성 FAQ 검증
  const allFaqIds = [...new Set(Object.values(FAQ_MAPPING).flat())];
  const validFaqs = await db
    .select({ id: faqs.id })
    .from(faqs)
    .where(and(inArray(faqs.id, allFaqIds), eq(faqs.isActive, true)));
  const faqSet = new Set(validFaqs.map((r) => r.id));
  const missingFaqs = allFaqIds.filter((id) => !faqSet.has(id));
  if (missingFaqs.length) {
    console.warn(`⚠️ 비활성/없는 faq ${missingFaqs.length}건 (제외):`);
    missingFaqs.forEach((id) => console.warn(`   - ${id}`));
  }

  // 3) roleKey별 업데이트
  const roleKeys = new Set([
    ...Object.keys(ARTICLE_MAPPING),
    ...Object.keys(FAQ_MAPPING),
  ]);
  for (const roleKey of roleKeys) {
    const articleIds = (ARTICLE_MAPPING[roleKey] ?? []).filter((id) =>
      articleSet.has(id),
    );
    const faqIds = (FAQ_MAPPING[roleKey] ?? []).filter((id) => faqSet.has(id));
    const res = await db
      .update(roleStarters)
      .set({ articleIds, faqIds })
      .where(eq(roleStarters.roleKey, roleKey))
      .returning({ id: roleStarters.id, label: roleStarters.label });
    if (res.length === 0) {
      console.warn(`⚠️ roleKey '${roleKey}' 없음 — 스킵`);
      continue;
    }
    console.log(
      `✅ [${roleKey}] "${res[0].label}" ← 가이드 ${articleIds.length}건 + FAQ ${faqIds.length}건`,
    );
  }

  console.log('\n완료. /role/{front|sales|housekeeping|manager|new_open} 즉시 반영.');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
