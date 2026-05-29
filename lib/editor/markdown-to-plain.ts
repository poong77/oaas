/**
 * 마크다운 → plain text 변환.
 *
 * 용도: SMS(솔라피) 발송 시 본문에 마크다운 문법이 잔존하면 사용자에게 그대로 노출되므로
 * 발송 직전에 본 helper로 정리한다.
 *
 * 정책:
 *   - 헤딩 # → 텍스트만 (제목 강조 없음)
 *   - 굵게/기울임/취소선 → 텍스트만
 *   - 링크 [텍스트](url) → "텍스트 (url)" (URL은 SMS에서 클릭 가능)
 *   - 이미지 ![alt](url) → "[이미지: alt]" (SMS에서 이미지는 표시 불가)
 *   - 글머리/체크/번호 목록 → "• " / "☐ ☑ " / 텍스트만
 *   - 코드 블록 → 텍스트만
 *   - 표 → "셀1 | 셀2" 형태
 *   - 인용 → "> " 제거
 *   - 구분선 → 제거
 *   - 3개 이상 연속 줄바꿈 → 2개로 정규화
 *
 * SMS 카운터는 호출자(매니저 UI)에서 본 결과 문자열의 length로 계산 (한글 1자 = 1자, SMS 80자 / LMS 90자+).
 */
export function markdownToPlain(md: string): string {
  if (!md) return '';

  // 0) HTML 태그 strip — RichEditor가 HTML로 저장하므로 우선 처리
  //    <br>, </p>, </div>, </h1~6>, </li> 는 개행으로
  //    나머지 태그는 제거
  let cleaned = md
    .replace(/<\/?(?:script|style|iframe)[^>]*>[\s\S]*?<\/(?:script|style|iframe)>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    // HTML entities 디코딩 (간단)
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  return (
    cleaned
      // 1) 코드 블록 ```code``` (먼저 처리 — 내부 마크다운 보존 위해)
      .replace(/```[a-zA-Z0-9]*\n?([\s\S]*?)```/g, (_, code: string) => code.trim())
      // 2) 인라인 코드 `code`
      .replace(/`([^`]+)`/g, '$1')
      // 3) 이미지 (링크보다 먼저 — ![alt](url) 에 [alt](url) 패턴 포함)
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt: string) =>
        alt.trim() ? `[이미지: ${alt.trim()}]` : '[이미지]',
      )
      // 4) 링크 [텍스트](url) → "텍스트 (url)"
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
      // 5) 헤딩 # ## ### → 텍스트만
      .replace(/^#{1,6}\s+/gm, '')
      // 6) 굵게 **text** / __text__ (먼저 — 기울임의 단일 *와 충돌 방지)
      .replace(/\*\*([^*\n]+)\*\*/g, '$1')
      .replace(/__([^_\n]+)__/g, '$1')
      // 7) 기울임 *text* / _text_
      .replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '$1')
      .replace(/(?<![A-Za-z0-9_])_([^_\n]+)_(?![A-Za-z0-9_])/g, '$1')
      // 8) 취소선 ~~text~~
      .replace(/~~([^~\n]+)~~/g, '$1')
      // 9) 체크리스트 - [ ] / - [x] (목록 일반보다 먼저)
      .replace(/^\s*[-*+]\s+\[([ xX])\]\s+/gm, (_, c: string) =>
        c.toLowerCase() === 'x' ? '☑ ' : '☐ ',
      )
      // 10) 글머리 목록 - / * / + → "• "
      .replace(/^\s*[-*+]\s+/gm, '• ')
      // 11) 번호 목록 1. 2. → 텍스트만
      .replace(/^\s*\d+\.\s+/gm, '')
      // 12) 인용 > 제거
      .replace(/^>\s?/gm, '')
      // 13) 표 구분 행 |---|---| 제거
      .replace(/^\|?[\s:-]+\|[\s:|-]+\|?\s*$/gm, '')
      // 14) 표 행 |a|b|c| → "a | b | c"
      .replace(/^\|(.+)\|$/gm, (_, row: string) =>
        row
          .split('|')
          .map((cell) => cell.trim())
          .filter(Boolean)
          .join(' | '),
      )
      // 15) 구분선 --- *** ___ 제거
      .replace(/^[-*_]{3,}\s*$/gm, '')
      // 16) HTML 태그 잔존 시 제거
      .replace(/<[^>]+>/g, '')
      // 17) 3+ 연속 줄바꿈 → 2개
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  );
}
