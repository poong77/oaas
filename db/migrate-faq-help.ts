/**
 * FAQ 데이터 마이그레이션 — help.oapms.com FAQ 분류 이관.
 *
 * 출처: https://help.oapms.com/ko/categories/FAQ-50dcca3d
 *   - 하위 카테고리: PMS / CMS / Keyless(+키오스크) / 기타문의
 *   - 원문 본문(질문·답변)을 채널.io RSC 페이로드에서 추출하여 그대로 이관.
 *   - 제품(productCode)·이슈유형(issueType)·검색키워드(keywords)를 함께 입력.
 *
 * 실행: `npm run db:migrate-faq-help`
 *   - DATABASE_URL 필요 (.env.local / .env).
 *   - 멱등: 동일 (productCode, question) 조합은 건너뜀. 재실행 안전.
 *   - 기존 "샘플 FAQ 12건"(seed.ts 가짜 예시)은 물리 삭제 후 실제 데이터로 대체.
 *   - 임베딩은 생성하지 않음 → 이후 `npm run db:backfill-faq-embeddings`로 일괄 생성.
 *
 * 중복 정책: 원본에서 '요금 관리'·'오버부킹'은 PMS·CMS 양쪽에 동일 내용으로
 *   존재하나, 본 이관에서는 CMS 1건으로 통합한다.
 */

import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

import { connectPg } from './connect';
import { and, eq, sql } from 'drizzle-orm';

import { faqs, type NewFaq } from './schema';

const DATABASE_URL = process.env.DATABASE_URL ?? '';

type MigrateFaq = {
  productCode: string;
  issueType: string | null;
  sortOrder: number;
  question: string;
  answerMarkdown: string;
  keywords: string[];
};

/** seed.ts 가 심은 샘플 FAQ 12건 — 물리 삭제 대상 (productCode, question) */
const SAMPLE_FAQS_TO_DELETE: Array<[string, string]> = [
  ['pms', 'PMS 로그인이 안 되는데 어떻게 해야 하나요?'],
  ['pms', '룸차트 위에서 마우스로 끌어서 예약을 옮길 수 있나요?'],
  ['cms', 'OTA(부킹닷컴 등) 요금을 일괄로 조정할 수 있나요?'],
  ['cms', 'CMS에서 변경한 재고가 PMS에 반영되지 않습니다'],
  ['keyless', '카드키 발급 시 "발급 실패" 오류가 나옵니다'],
  ['keyless', '체크아웃 후 카드키를 자동으로 만료시킬 수 있나요?'],
  ['kiosk', '키오스크가 결제 단계에서 멈춥니다'],
  ['kiosk', '키오스크 메인 화면 광고 이미지를 변경하려면?'],
  ['web', '호텔 홈페이지의 다국어를 추가하려면?'],
  ['web', '홈페이지가 https로 열리지 않습니다'],
  ['config', '직원 계정을 추가하려면 어떻게 하나요?'],
  ['config', '관리자 비밀번호를 분실했어요'],
];

const MIGRATE_FAQS: MigrateFaq[] = [
  // ─── 기타문의 (2) ────────────────────────────────────────────────
  {
    productCode: 'config',
    issueType: 'feature_inquiry',
    sortOrder: 10,
    question: 'AS 사이트 계정 정보(아이디/비밀번호)를 잊어버렸어요.',
    keywords: [
      'AS사이트',
      '계정',
      '아이디',
      '비밀번호',
      '비번분실',
      '로그인',
      '계정복구',
      '비밀번호초기화',
    ],
    answerMarkdown: `계정 정보를 잊으셨다면 아래 절차로 도와드립니다.

1. **대표번호 문의** — 대표번호 1833-4702 → 내선 1번으로 전화해 주세요.
2. **계정 확인 요청** — 통화 시, 숙소명과 함께 "AS 사이트 계정 정보를 잊어버렸다"고 문의해 주세요.
3. **ID 및 비밀번호 안내**
   - ID는 확인하여 안내드립니다.
   - 비밀번호의 경우, 초기화를 도와드립니다.
4. **비밀번호 관리 안내** — AS 사이트 계정은 숙소당 1개만 제공되므로, 변경된 비밀번호는 숙소 내부적으로 공유 및 관리해 주시기 바랍니다.`,
  },
  {
    productCode: 'config',
    issueType: 'etc',
    sortOrder: 20,
    question: '헬프센터에 없는 그 외 내용은 어디로 문의하나요?',
    keywords: [
      '문의',
      '고객센터',
      '대표번호',
      '연락처',
      '이메일',
      '긴급문의',
      '운영시간',
      '게시판',
    ],
    answerMarkdown: `헬프센터 내 없는 그 외 내용은 오아테크로 문의해주세요!

**☎️ 대표번호: 1833-4702**
- 1번: 시스템 문의
- 2번: 도입 상담
- 3번: 회계·기타

평일 10:00–18:40, 접수마감 18:00 (점심시간 12:00–13:00)
주말(토·일) 및 (대체)공휴일 휴무

- ⌨️ 게시판: as.oapms.com
- 📧 이메일: as@oapms.com
- 🚨 긴급문의: 070-8028-0919
  - 영업시간 외 야간/주말 지원
  - 시스템 장애(접속불가) 전용
  - 단순 데이터 수정·사용법 등 일반문의는 대응 불가`,
  },

  // ─── PMS (7) ─────────────────────────────────────────────────────
  {
    productCode: 'pms',
    issueType: 'feature_inquiry',
    sortOrder: 10,
    question: 'TODAY 기능 잘 쓰고 싶어요.',
    keywords: [
      'TODAY',
      '오늘',
      '객실현황',
      '체크인예정',
      '체크아웃예정',
      '당일예약',
      '노쇼',
      '객실관리',
    ],
    answerMarkdown: `**✔️ 객실 현황의 [TODAY]란?**
객실PMS > 객실관리 > 객실현황 메뉴 내 버튼으로, **[오늘] 예약 건**을 한번에 모아서 표시합니다.

## PMS 내 TODAY 기능 사용법

**1. 당일 체크인 예정 예약**
- 당일 체크인 할 예약 건을 확인합니다.
- [예약자명]을 더블 클릭 시, 상세 정보를 볼 수 있습니다. (예약등록 메뉴로 이동)
- [체크인] 버튼으로 바로 체크인으로 이동합니다.
- [체크인] 옆 [금액]은 고객이 결제할 금액/잔액을 표시합니다.

노쇼 건을 쉽게 확인하고 대응할 수 있습니다. (고객 연락, 재판매 등) 특히, 노쇼 건을 미리 처리하면 일마감 시 노쇼 팝업이 뜨지 않기 때문에 편리해집니다. OTA에 따라 현장 결제가 필요한 경우, 현장 결제 건임을 미리 표시해두면 업무 시 편리합니다. (예약자명에 표시)

**2. 당일 체크인한 객실**
- 체크인 한 객실을 리스트 형태로 보여줍니다.
- [투숙객명]을 더블 클릭 시, 상세정보를 조회합니다. (체크인/아웃 메뉴로 이동)
- 우측 [금액] 칸에서 고객이 결제할 금액/잔액을 표시합니다.

**3. 당일 체크아웃 예정 객실**
- 퇴실 할 객실을 리스트 형태로 보여줍니다.
- [투숙객명]을 더블 클릭 시, 상세 정보를 조회합니다. (체크인/아웃 메뉴로 이동)
- 우측 [금액] 칸에서 고객이 결제할 금액/잔액을 표시합니다.

퇴실 시간 전 해당 건을 모아서 한번에 퇴실 요청을 하거나, 퇴실 시간 이후 퇴실 여부를 확인하는 데 사용하면 편리합니다. 결제할 금액이 남아있는 경우, 퇴실 전 반드시 확인해보세요.`,
  },
  {
    productCode: 'pms',
    issueType: 'data_fix',
    sortOrder: 20,
    question: '매출을 잘못 입력했어요.',
    keywords: [
      '매출수정',
      '매출정정',
      '입금수정',
      '상계처리',
      '가상객실',
      '포스팅',
      '매출오류',
      '일마감',
    ],
    answerMarkdown: `PMS는 대표·관리자·직원 등 여러 명이 데이터를 입력 및 관리하므로, 매출이나 입금액이 잘못 입력된 경우 **영업일자로 상계처리**합니다. 지난 일자의 데이터 및 보고서가 변경되면 혼선이 생기기 때문입니다.

1. **'가상객실'로 예약을 생성**합니다.
   - 가상객실로 예약을 생성하면 판매객실 수로 집계되지 않습니다.
2. 입실일·퇴실일을 **영업일자로 설정** 후, 체크인 처리해주세요.
   - (매출조정 후 바로 체크아웃 처리하므로, 퇴실일도 동일하게 설정)
3. **잘못 포스팅된 매출과 입금을 포스팅**합니다.
   - 예) 2026-03-02 309호 객실료가 50,000원이었으나, 마감 후 70,000원으로 매출이 포스팅된 경우 (대외후불로 입금액도 70,000원으로 처리됨)
   - a. **매출 등록**: 판매가에 조정해야 할 금액을 +, − 로 입력합니다. (예: '−20,000'원 입력)
   - b. **입금 등록**: 금액에 조정해야 할 금액을 +, − 로 입력하고, 비고 란에 사유를 입력합니다. (예: '−20,000'원 입력)
4. 입력된 매출과 입금액을 확인합니다.
5. 체크아웃 처리합니다.`,
  },
  {
    productCode: 'pms',
    issueType: 'error',
    sortOrder: 30,
    question: 'PMS 객실현황(이달) 화면이 안보여요.',
    keywords: [
      '객실현황',
      '이달',
      '화면안보임',
      '재고생성',
      '기본자료생성',
      '일자별구분',
      '재고',
      '객실설정',
    ],
    answerMarkdown: `PMS 객실현황(이달) 화면이 보이지 않는 경우, 아래 경로로 설정이 필요합니다.

1. **PMS → 객실관리 → 객실 재고(타입별) → 최종일자 확인**
   - 최종일자가 2025-12-31인 경우, 기간: 2026-01-01~2026-12-31 설정 → **[재고 생성]** 버튼 클릭
2. **PMS → 설정 → 객실설정 → 일자별 구분 설정 → 최종일자 확인**
   - 최종일자가 2025-12-31인 경우, 기간: 2026-01-01~2026-12-31 설정 → **[기본자료생성]** 버튼 클릭`,
  },
  {
    productCode: 'pms',
    issueType: 'feature_inquiry',
    sortOrder: 40,
    question: '카드 결제 단말기를 교체 했는데 어떻게 PMS 와 연동할 수 있을까요?',
    keywords: [
      '카드단말기',
      '결제단말기',
      '단말기교체',
      'PMS연동',
      '카드결제',
      '단말기설정',
      '원격설정',
      'POS',
    ],
    answerMarkdown: `1. **문의 접수** — 카드 결제 단말기를 교체하신 경우, AS 사이트에 문의 글을 등록해 주시기 바랍니다.
2. **담당자 확인 및 연락** — 문의 접수 후, 오아테크 담당자가 내용을 확인하여 직접 연락을 드립니다.
3. **원격 지원 및 설정 진행** — 담당자가 숙소 PC를 원격 연결하여 카드 결제 단말기 설정을 진행합니다.
4. **PMS 연동 완료** — 단말기 설정이 완료되면, 이후부터 PMS와 정상적으로 연동되어 사용 가능합니다.

**※ 유의사항**
- 단말기 교체 후 별도 설정 없이 바로 사용 시, PMS와 연동되지 않습니다.
- 반드시 AS 문의 후 담당자 안내에 따라 진행해 주시기 바랍니다.`,
  },
  {
    productCode: 'pms',
    issueType: 'feature_inquiry',
    sortOrder: 50,
    question: '노쇼 예약인데 숙박료는 받았습니다. PMS에 어떻게 처리하나요?',
    keywords: [
      '노쇼',
      'NOSHOW',
      '숙박료',
      '결제',
      '매출입력',
      '가상객실',
      '체크인처리',
      '판매객실수',
    ],
    answerMarkdown: `노쇼 예약이지만 결제는 받은 경우, 아래 두 가지 방법으로 처리합니다.

**1. 판매 객실 수로 포함 🅾️**
- a. 체크인 처리를 진행합니다. (체크인 처리하지 않고 일마감을 하면 노쇼 처리됩니다.)
- b. 결제 받은 금액만큼 매출을 입력합니다.
- c. 결제수단을 선택하여 입금도 입력합니다.
- d. 체크아웃 일자를 영업일자로 변경 후, 체크아웃 처리합니다.
- ※ 비고 란에 노쇼 관련 내용을 메모하면 추후 참고하기 좋습니다!

**2. 판매 객실 수로 포함 ❌**
- a. '가상객실'로 예약을 생성합니다. (가상객실로 생성하면 판매객실 수로 집계되지 않습니다.)
- b. 입실일·퇴실일을 영업일자로 설정 후, 체크인 처리해주세요.
- c. 결제 받은 금액만큼 매출을 입력합니다.
- d. 결제수단을 선택하여 입금도 입력합니다.
- ※ 비고 란에 노쇼 관련 내용을 메모하면 추후 참고하기 좋습니다!`,
  },
  {
    productCode: 'pms',
    issueType: 'feature_inquiry',
    sortOrder: 60,
    question: '신규 직원이 입사하여 PMS ID를 추가하려고 하는데, 어떻게 추가하면 될까요?',
    keywords: [
      '신규직원',
      'PMS ID',
      '계정추가',
      'ID추가',
      '직원계정',
      '입사',
      '계정생성',
      'AS문의',
    ],
    answerMarkdown: `숙소 측에서는 ID 직접 추가가 불가하며, **AS 사이트에 문의글로 신규 직원 성함과 생성하실 ID를 남겨주시면** 오아테크에서 추가를 도와드리고 있습니다.`,
  },
  {
    productCode: 'pms',
    issueType: 'error',
    sortOrder: 70,
    question: 'PMS 속도가 느려요.',
    keywords: [
      '속도',
      '느림',
      '지연',
      '인터넷속도',
      '성능',
      '원격지원',
      'PMS느림',
      '버벅임',
    ],
    answerMarkdown: `PMS 속도가 전에 비해 느려졌다면, 아래 증상을 확인해주세요.

1. **인터넷 속도를 확인**해주세요. 다른 사이트도 동일하게 느린지, PMS만 느린지 비교해주세요.
2. **어떤 작업을 할 때 느린지**, 특정 메뉴 조회 시에만 느린지 확인해주세요.
3. 위 내용 확인 후, **오아테크 AS 사이트에 문의글 접수** 부탁드립니다. 저희쪽에서도 동일 현상이 발생하는지 확인 후 원격으로 지원해드립니다.`,
  },

  // ─── CMS (4) — '요금 관리'·'오버부킹' 은 CMS로 통합 ────────────────
  {
    productCode: 'cms',
    issueType: 'error',
    sortOrder: 10,
    question: 'CMS에 재고반영이 안됩니다.',
    keywords: [
      '재고반영',
      '재고동기화',
      '재고재계산',
      '오버부킹',
      'CMS재고',
      '동기화지연',
      '재고전송',
      '객실재고',
    ],
    answerMarkdown: `**Q.** PMS에서 수기로 예약 생성 후, CMS로 재고 반영되는데 얼마나 시간이 걸릴까요? 오버부킹될 우려가 있네요.

**A.** 기본적으로 재고 반영은 **즉각적으로** 이루어집니다. 즉, 예약 생성 직후나 객실타입 이동 등으로 재고 변동이 있는 경우 즉시 CMS로 재고를 전송합니다.

- 어느 정도 기다려도 반영이 안 된다는 판단이 들면, **PMS → 객실재고 → [재고 재계산]** 버튼을 클릭하시면 바로 동기화됩니다.
- 그래도 재고 연동이 이루어지지 않는다면, AS 페이지를 통해 이슈를 등록해주세요.`,
  },
  {
    productCode: 'cms',
    issueType: 'feature_inquiry',
    sortOrder: 20,
    question: '요금 관리는 어떻게 하나요?',
    keywords: [
      '요금관리',
      '객실단가',
      '기본단가',
      'RACK RATE',
      '일자별요금',
      '셀프체크인요금',
      '대실요금',
      '부킹엔진요금',
      'CMS요금',
    ],
    answerMarkdown: `PMS는 요금타입을 다양하게 분리하고 있습니다.

- **객실단가/기본단가(Rack rate)**: 기본으로 세팅한 요금
- **일자/기간별 요금**: 공휴일·요일별로 다양하게 세팅하는 요금으로, 기본단가를 기준으로 +/− 하여 조정
- **셀프체크인 요금**: 키오스크에서 판매하는 숙박요금
- **대실 요금**: 시간제 이용을 하는 경우 (키오스크 내 표시)
- 위 요금은 모두 **설정 > 객실설정**에서 관리합니다.
- **홈페이지/부킹엔진 요금**: 홈페이지에서 예약하는 경우 — **홈페이지 > 객실 상품 및 가격**에서 관리

명절·휴일·대체공휴일 세팅은 **설정 > 객실설정 > 일자별 구분 설정**에서 가능합니다.

만약 CMS를 사용하는 경우, PMS 내 요금과 별도로 CMS에서 요금을 세팅하셔야 합니다. 판매채널 내 노출하는 요금을 유연하게 관리하기 위해, PMS 내 요금 정보와는 동기화되지 않습니다.`,
  },
  {
    productCode: 'cms',
    issueType: 'error',
    sortOrder: 30,
    question: '오버부킹이 발생했어요.',
    keywords: [
      '오버부킹',
      'OVERBOOKING',
      '중복예약',
      'OTA',
      '취소유도',
      '재고',
      '채널매니저',
      '예약취소',
    ],
    answerMarkdown: `## 오버부킹 대응은 어떻게 하나요?

1. 고객에게 **취소 유도**를 해주세요.
   - **자가 해결**: 전화·문자·OTA채팅 등으로 연락 (대리인은 해결이 어렵습니다 😅)
   - **OTA 도움요청**: 연락처가 기재되어 있지 않거나 연락이 닿지 않는 경우, OTA로 지원/취소 요청

2. **오버부킹 원인**을 알고 싶어요.
   - 오버부킹은 여러 시스템 연동 구조 상 일어날 수 있으며, 대부분의 원인은 **데이터 지연, 누락, 매핑 오류, 객실타입 변경**에 속합니다.
   - 최근 들어 자주 일어난다면 원인을 파악해 개선할 필요가 있습니다.
     - **AS 접수**: 오버부킹 예약번호·일자를 남겨주세요.
     - **확인 과정**: PMS → CMS → OTA 3개 사 확인이 필요해 다소 시일이 소요됩니다.
     - **결과**
       - OTA 귀책인 경우, 증빙자료 제출을 통해 패널티 면제 가능
       - 그 외 귀책인 경우, 재발 방지를 위해 기능 개선 및 운영 정책 업데이트

---

**☑️ 이런 이슈에도 채널매니저(CMS)를 사용해야 하는 이유**
- 업무 절감 효과, 판매증대 효과가 비용을 크게 상회합니다.
- 예상되는 이슈가 최소화되도록 숙소 운영방식을 확립하세요.
- 오아테크가 함께 이슈를 최소화할 수 있도록 노력하겠습니다.`,
  },
  {
    productCode: 'cms',
    issueType: 'feature_inquiry',
    sortOrder: 40,
    question: 'CMS 사용 시 입금액은 어디에서 확인하나요?',
    keywords: [
      '입금액',
      '입금금액',
      '판매금액',
      'OTA',
      '아고다',
      '엑스트라넷',
      'CMS입금',
      '정산',
    ],
    answerMarkdown: `**Q.** CMS를 통해 아고다 예약 건이 접수되었습니다. 예약등록 메뉴에 판매금액이 입력되어 있는데, 입금금액은 어디서 확인하나요?

**A.** PMS의 금액은 **고객이 결제한 객실료**입니다. 입금금액은 **각 채널(OTA)의 엑스트라넷**에서 확인하셔야 합니다.`,
  },

  // ─── 키오스크 (2) ────────────────────────────────────────────────
  {
    productCode: 'kiosk',
    issueType: 'feature_inquiry',
    sortOrder: 10,
    question: '키오스크 영수증은 어떻게 추가 구매하나요?',
    keywords: [
      '키오스크',
      '영수증',
      '감열지',
      '용지구매',
      '영수증용지',
      '추가구매',
      '한솔감열지',
      '소모품',
    ],
    answerMarkdown: `영수증 업체에서는 감열지를 개당 1,000원에 판매하고 있습니다. 구매는 12개입 또는 1박스(50개입) 단위로만 가능합니다.

- **12개입**: 12,000원 + 배송비 3,200원 (착불)
- **50개입**: 50,000원 (배송비 무료)

다소 비싼 편입니다. 한편, 쿠팡에서도 동일 규격의 감열지를 구매하실 수 있습니다.

- **한솔 감열지 (79×70) 24개입**: 23,900원 — 보다 저렴하게 구매 가능합니다.`,
  },
  {
    productCode: 'kiosk',
    issueType: 'feature_inquiry',
    sortOrder: 20,
    question: '키오스크 영수증 용지 교체 후 초기화 방법',
    keywords: [
      '키오스크',
      '영수증',
      '용지교체',
      '초기화',
      'FEED',
      'ERR',
      '프린터',
      '감열지교체',
    ],
    answerMarkdown: `키오스크 영수증 용지 교체 시, 초기화 작업은 필수로 진행해 주셔야 합니다.

초기화 방법은 아래 영상 링크를 참고 부탁드립니다.
👉 https://drive.google.com/file/d/17nWpZ5dpGep-leV8YzR4wGQrp9dk7lAO/view

1. 영수증 용지를 교체합니다.
2. **FEED 버튼을 5초 이상** 길게 누릅니다.
3. **ERR 버튼에 빨간 불**이 들어오는지 확인합니다.
4. 영수증 용지를 제거한 상태로 영수증 커버(박스)를 닫습니다.`,
  },

  // ─── Keyless (2) ─────────────────────────────────────────────────
  {
    productCode: 'keyless',
    issueType: 'error',
    sortOrder: 10,
    question: "도어락이 '연결시도중'으로 뜹니다.",
    keywords: [
      '도어락',
      '연결시도중',
      '공유기',
      'WiFi',
      '모듈',
      '네트워크',
      '인터넷연결',
      '도어락연결',
    ],
    answerMarkdown: `1. **도어락 모듈과 연결된 공유기(WiFi) 인터넷 접속 연결 확인**
   - 현장 확인자 핸드폰으로 해당 공유기(WiFi) 인터넷 접속 확인
   - 접속 불가 시 공유기(WiFi) 이상으로 통신사에 문의
2. **객실의 공유기(WiFi)와 도어락 전원 상태 확인** — 상시전원 필수
3. **도어락 내 모듈 정상 부착 여부 확인**
4. **공유기 랜선 확인** — 투숙객이 공유기에 연결된 랜선 등을 빼놓는 경우, 랜선 원상 복구
5. **객실 네트워크 변경(공유기/통신사 변경, 네트워크 제공사 등) 시, 모듈 재설정 필수**
   - 공유기(WiFi) 접속 시 패스워드 설정 필수 (패스워드 미설정 공유기 불가)
   - 모듈 설정 WiFi(무선연결) 대역 **2.4GHz 필수** (5GHz 이상 대역 연결 불가)

▶️ 모듈 설정 가이드 동영상: https://youtu.be/MFAlvwODHls`,
  },
  {
    productCode: 'keyless',
    issueType: 'error',
    sortOrder: 20,
    question: '폰키 발급이 안돼요.',
    keywords: [
      '폰키',
      '폰키발급',
      '발급안됨',
      '도어락',
      '공유기',
      'WiFi',
      '모듈재설정',
      '네트워크',
    ],
    answerMarkdown: `1. **도어락 모듈과 연결된 공유기(WiFi) 인터넷 접속 연결 확인**
   - 현장 확인자 핸드폰으로 해당 공유기(WiFi) 인터넷 접속 확인
   - 접속 불가 시 공유기(WiFi) 이상으로 통신사에 문의
2. **객실의 공유기(WiFi)와 도어락 전원 상태 확인** — 상시전원 필수
3. **도어락 내 모듈 정상 부착 여부 확인**
4. **공유기 랜선 확인** — 투숙객이 공유기에 연결된 랜선 등을 빼놓는 경우, 랜선 원상 복구
5. **객실 네트워크 변경(공유기/통신사 변경, 네트워크 제공사 등) 시, 모듈 재설정 필수**
   - 공유기(WiFi) 접속 시 패스워드 설정 필수 (패스워드 미설정 공유기 불가)
   - 모듈 설정 WiFi(무선연결) 대역 **2.4GHz 필수** (5GHz 이상 대역 연결 불가)

▶️ 모듈 설정 가이드 동영상: https://youtu.be/MFAlvwODHls`,
  },
];

async function main() {
  if (!DATABASE_URL.startsWith('postgres')) {
    console.error('❌ DATABASE_URL 미설정. 중단.');
    process.exit(1);
  }

  const { db } = connectPg(DATABASE_URL);

  // ─── 1. 기존 샘플 FAQ 12건 물리 삭제 ──────────────────────────────
  console.log('🗑  기존 샘플 FAQ 12건 물리 삭제...');
  let deleted = 0;
  for (const [productCode, question] of SAMPLE_FAQS_TO_DELETE) {
    const res = await db
      .delete(faqs)
      .where(and(eq(faqs.productCode, productCode), eq(faqs.question, question)))
      .returning({ id: faqs.id });
    deleted += res.length;
  }
  console.log(`   삭제 완료: ${deleted}건`);

  // ─── 2. help.oapms.com FAQ 17건 이관 (멱등) ──────────────────────
  console.log(`\n📥 help.oapms.com FAQ ${MIGRATE_FAQS.length}건 이관...`);
  let created = 0;
  let skipped = 0;
  for (const f of MIGRATE_FAQS) {
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
    console.log(`   NEW   [${f.productCode}] ${f.question}`);
  }

  console.log(
    `\n✅ 이관 완료 — 신규 ${created}건 / 스킵 ${skipped}건 / 삭제 ${deleted}건`,
  );
  console.log('💡 다음: `npm run db:backfill-faq-embeddings` 로 임베딩 생성');
  await db.execute(sql`ANALYZE faqs`);
  process.exit(0);
}

main().catch((err) => {
  console.error('마이그레이션 실패:', err);
  process.exit(1);
});
