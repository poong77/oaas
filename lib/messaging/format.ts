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

/** 메일 본문 HTML 하단에 붙는 푸터 HTML. */
export function buildMailFooterHtml(): string {
  const f = MAIL_FOOTER;
  return [
    '<div style="margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:12px;line-height:1.7;color:#64748b;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',\'Apple SD Gothic Neo\',sans-serif;">',
    `<div style="font-weight:700;color:#334155;font-size:13px;">${f.companyKo}&nbsp;&nbsp;|&nbsp;&nbsp;<span style="color:#94a3b8;">${f.companyEn}</span></div>`,
    `<div>${f.hq}</div>`,
    `<div>${f.seoul}</div>`,
    `<div style="margin-top:4px;">${f.tel}&nbsp;&nbsp;|&nbsp;&nbsp;${f.fax}</div>`,
    '</div>',
  ].join('');
}

/** 메일 text 파트 하단 푸터(plain). */
export function buildMailFooterText(): string {
  const f = MAIL_FOOTER;
  return ['', '----------', `${f.companyKo} | ${f.companyEn}`, f.hq, f.seoul, `${f.tel} | ${f.fax}`].join('\n');
}
