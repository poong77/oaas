/**
 * 메일&문자 공용 포맷 유틸 (클라이언트/서버 공용 — server-only 금지).
 *
 * - 본문 변수(치환 토큰) 정의 및 치환
 * - 문자 유형(SMS/LMS/MMS) 판정 · byte 길이
 * - 메일 푸터(회사 정보) HTML/Plain 생성
 */

/** 본문에 삽입 가능한 치환 변수. 클릭 칩 + 발송 시 수신자별 치환에 공용. */
export const MESSAGE_VARIABLES = [
  { token: '#{업체명}', label: '업체명', key: '업체명' },
  { token: '#{담당자명}', label: '담당자명', key: '담당자명' },
  { token: '#{연락처}', label: '연락처', key: '연락처' },
  { token: '#{호텔명}', label: '호텔명', key: '호텔명' },
] as const;

export type MessageVarKey = (typeof MESSAGE_VARIABLES)[number]['key'];
export type MessageVars = Partial<Record<MessageVarKey, string | null | undefined>>;

const VAR_RE = /#\{(업체명|담당자명|연락처|호텔명)\}/g;

/** 템플릿의 #{변수}를 수신자 값으로 치환. 값 없으면 빈 문자열. */
export function substituteVars(template: string, vars: MessageVars): string {
  return template.replace(VAR_RE, (_, key: string) => {
    const v = vars[key as MessageVarKey];
    return v == null ? '' : String(v);
  });
}

/** 템플릿에 사용된 변수 토큰 목록(중복 제거, 정의 순서). */
export function usedVariables(template: string): string[] {
  const found = new Set<string>();
  for (const m of template.matchAll(VAR_RE)) found.add(`#{${m[1]}}`);
  return MESSAGE_VARIABLES.filter((v) => found.has(v.token)).map((v) => v.token);
}

// ─────────────────────────────────────────────────────────────────────
// 변수 바인딩 (MSG-15) — 동적 변수(커스텀 변수명 포함) + 값 소스
// ─────────────────────────────────────────────────────────────────────

/** 기본 변수명(연락처 자동주입 가능). 커스텀 변수는 이 외 임의 이름. */
export const BASE_VAR_NAMES = MESSAGE_VARIABLES.map((v) => v.key) as string[];

/** 임의 토큰 매칭(기본 4종 + 커스텀 변수명1~7 등). 이름 1~40자. */
const ANY_VAR_RE = /#\{([^}\n]{1,40})\}/g;

/** 값 소스: auto=연락처 자동주입 / manual=직접입력(전 수신자 공통) / excel=엑셀 열 */
export type VarSource = 'auto' | 'manual' | 'excel';

/** 본문 변수 1건의 값 결정 규칙. */
export type VarBinding = {
  /** 변수명 (토큰은 `#{name}`). */
  name: string;
  source: VarSource;
  /** source='manual'일 때 전 수신자 공통 값. */
  value?: string | null;
};

/** 템플릿(본문+제목)에 실제 사용된 변수명 목록(중복 제거, 등장 순서). */
export function extractVarNames(...templates: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of templates) {
    if (!t) continue;
    for (const m of t.matchAll(ANY_VAR_RE)) {
      const name = m[1].trim();
      if (name && !seen.has(name)) {
        seen.add(name);
        out.push(name);
      }
    }
  }
  return out;
}

/**
 * 수신자 1명의 변수 값 맵을 바인딩 + 수신자 데이터로 해석.
 * - auto: recipient.auto[name] (호텔 연락처 자동주입)
 * - manual: binding.value (전 수신자 공통)
 * - excel: recipient.excel[name] (업로드 행 값)
 */
export function resolveRecipientVars(
  bindings: VarBinding[],
  recipient: {
    auto?: Record<string, string | null | undefined>;
    excel?: Record<string, string | null | undefined>;
  },
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const b of bindings) {
    const name = b.name.trim();
    if (!name) continue;
    if (b.source === 'manual') out[name] = (b.value ?? '').toString();
    else if (b.source === 'excel') out[name] = (recipient.excel?.[name] ?? '').toString();
    else out[name] = (recipient.auto?.[name] ?? '').toString();
  }
  return out;
}

/** 임의 토큰을 값 맵으로 치환. 값 없으면 빈 문자열. */
export function substituteAll(
  template: string,
  values: Record<string, string | null | undefined>,
): string {
  return template.replace(ANY_VAR_RE, (_, raw: string) => {
    const v = values[raw.trim()];
    return v == null ? '' : String(v);
  });
}

/** 한국형 byte 길이 (한글 등 비ASCII 2, ASCII 1). */
export function byteLength(s: string): number {
  let n = 0;
  for (const ch of s) n += ch.charCodeAt(0) > 0x7f ? 2 : 1;
  return n;
}

export type SmsKind = 'sms' | 'lms' | 'mms';

/** 문자 유형 판정: 이미지 → MMS, 제목 있거나 90byte 초과 → LMS, 그 외 SMS. */
export function classifySms(opts: {
  text: string;
  hasSubject?: boolean;
  hasImage?: boolean;
}): SmsKind {
  if (opts.hasImage) return 'mms';
  if (opts.hasSubject || byteLength(opts.text) > 90) return 'lms';
  return 'sms';
}

export function smsKindLabel(kind: SmsKind): string {
  return kind === 'mms' ? 'MMS' : kind === 'lms' ? 'LMS' : 'SMS';
}

// ─────────────────────────────────────────────────────────────────────
// 메일 푸터 (회사 정보) — 발송 시 본문 하단 자동 첨부
// ─────────────────────────────────────────────────────────────────────

export const MAIL_FOOTER = {
  companyKo: '(주)오아테크',
  companyEn: 'OA TECH.inc',
  hq: '본사. [35260] 대전광역시 서구 문예로 11, 소천빌딩 2층 (탄방동)',
  seoul: '서울오피스. [08513] 서울 금천구 디지털로 178, 퍼블릭가산 B동 712호 (가산동)',
  tel: 'Tel. 1833-4702',
  fax: 'Fax. 0505-300-4702',
} as const;

/**
 * 푸터 기본 콘텐츠(마크다운). 어드민이 별도 저장하기 전까지 이 값이 사용된다.
 * 첨부 이미지(회사 정보 푸터)와 동일한 내용.
 */
export const DEFAULT_MAIL_FOOTER_MD = [
  `**${MAIL_FOOTER.companyKo}**  |  ${MAIL_FOOTER.companyEn}`,
  '',
  MAIL_FOOTER.hq,
  '',
  MAIL_FOOTER.seoul,
  '',
  `${MAIL_FOOTER.tel}  |  ${MAIL_FOOTER.fax}`,
].join('\n');

/**
 * 푸터 HTML을 메일 본문 하단 컨테이너(상단 구분선·muted 색)로 감싼다.
 * `innerHtml`은 푸터 마크다운을 markdownToHtml로 변환한 결과.
 */
export function wrapMailFooterHtml(innerHtml: string): string {
  return [
    '<div style="margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:12px;line-height:1.7;color:#64748b;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',\'Apple SD Gothic Neo\',sans-serif;">',
    innerHtml,
    '</div>',
  ].join('');
}

/** 메일 text 파트 하단 푸터(plain). `footerPlain`은 푸터 마크다운→plain 변환 결과. */
export function wrapMailFooterText(footerPlain: string): string {
  return ['', '----------', footerPlain.trim()].join('\n');
}
