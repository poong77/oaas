/**
 * 마크다운 → HTML 변환.
 *
 * 용도: SES 이메일 발송 시 본문 마크다운을 HTML로 변환.
 * 호출자(ses.ts)가 <head>/<body> 래핑 + 인라인 스타일 추가.
 *
 * 정책:
 *   - GFM (표·체크리스트·취소선) 지원
 *   - breaks: true (줄바꿈을 <br>로) — 메일 본문은 줄바꿈 유지가 중요
 *   - mangle 비활성 — 이메일 주소 mangle 불필요
 *   - 결과 HTML은 호출자에서 안전한 도메인으로만 보내거나 추가 sanitize 권장
 */

import { marked } from 'marked';

marked.setOptions({
  gfm: true,
  breaks: true,
  pedantic: false,
});

/** 마크다운 문자열 → HTML 문자열 (동기). 이미 HTML이면 그대로 반환. */
export function markdownToHtml(md: string): string {
  if (!md) return '';
  // HTML 감지: 본문이 <tag>로 시작하면 이미 HTML로 간주 (RichEditor HTML 저장 모드)
  if (/^\s*<[a-zA-Z]/.test(md)) {
    return md;
  }
  // marked v14+는 기본 동기. async: false 명시로 Promise 반환 방지.
  return marked.parse(md, { async: false }) as string;
}
