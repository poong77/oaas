/**
 * 마크다운 → Slack mrkdwn 변환.
 *
 * 용도: Slack Webhook(`#as-new` / `#as-urgent` / `#dev-escalation`) 발송 시
 * 본문 마크다운을 Slack의 mrkdwn 문법으로 변환.
 *
 * 표준 마크다운 vs Slack mrkdwn 차이:
 *   - 굵게:    **text**  →  *text*
 *   - 기울임:  *text* / _text_  →  _text_
 *   - 취소선:  ~~text~~  →  ~text~
 *   - 링크:    [텍스트](url)  →  <url|텍스트>
 *   - 이미지:  ![alt](url)  →  <url|이미지: alt>  (Slack은 본문 이미지 임베드 불가, 링크만)
 *   - 헤딩:    # 제목  →  *제목*  (Slack에 헤딩 문법 없음, 굵게로 대체)
 *   - 인라인 코드, 코드블록, 인용(>), 목록(•)은 동일
 *   - 표: Slack에 표 문법 없음. plain "| 구분"으로 fallback
 *
 * 참고: https://api.slack.com/reference/surfaces/formatting
 *
 * 호출자: lib/notifications/slack.ts (Block Kit의 mrkdwn 블록에 본 결과 삽입)
 */
export function markdownToSlackMrkdwn(md: string): string {
  if (!md) return '';

  // 0) HTML 입력 감지 — RichEditor HTML 저장 모드 대응
  //    HTML 태그를 Slack mrkdwn에 가깝게 변환 (간단 처리)
  let input = md;
  if (/<[a-zA-Z][^>]*>/.test(input)) {
    input = input
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
      .replace(/<(b|strong)[^>]*>([\s\S]*?)<\/(b|strong)>/gi, '*$2*')
      .replace(/<(i|em)[^>]*>([\s\S]*?)<\/(i|em)>/gi, '_$2_')
      .replace(/<s[^>]*>([\s\S]*?)<\/s>/gi, '~$1~')
      .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`')
      .replace(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, '<$1|$2>')
      .replace(/<[^>]+>/g, '') // 나머지 태그 제거 (style·color·align 등은 Slack 표현 불가)
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }

  // 코드 블록은 변환에서 제외해야 내용 보존됨 → 토큰화 후 마지막에 복원
  const codeBlocks: string[] = [];
  const inlineCodes: string[] = [];

  let out = input
    // 1) 코드 블록 토큰화 ```...```
    .replace(/```[a-zA-Z0-9]*\n?([\s\S]*?)```/g, (_, code: string) => {
      const idx = codeBlocks.length;
      codeBlocks.push(code);
      return `__SLACK_CODE_BLOCK_${idx}__`;
    })
    // 2) 인라인 코드 토큰화 `...`
    .replace(/`([^`\n]+)`/g, (_, code: string) => {
      const idx = inlineCodes.length;
      inlineCodes.push(code);
      return `__SLACK_INLINE_CODE_${idx}__`;
    })
    // 3) 이미지 ![alt](url) → <url|이미지: alt> (링크보다 먼저)
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt: string, url: string) => {
      const label = alt.trim() ? `이미지: ${alt.trim()}` : '이미지';
      return `<${url}|${label}>`;
    })
    // 4) 링크 [텍스트](url) → <url|텍스트>
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<$2|$1>')
    // 5) 헤딩 # → *굵게*
    .replace(/^#{1,6}\s+(.+)$/gm, '*$1*')
    // 6) 굵게 **text** / __text__ → *text*
    .replace(/\*\*([^*\n]+)\*\*/g, '*$1*')
    .replace(/__([^_\n]+)__/g, '*$1*')
    // 7) 기울임 *text* → _text_ (이미 **로 치환된 단일 * 보호 위해 lookahead/behind)
    //    표준 마크다운의 *기울임*은 한글 컨텍스트에서 거의 안 쓰이고,
    //    Slack은 * = 굵게이므로 의도하지 않은 변환 방지를 위해 단어 경계가 명확할 때만 처리.
    //    안전을 위해 _기울임_은 그대로 두고, *기울임*만 _기울임_으로.
    //    위 6)에서 **가 *로 변환됐기 때문에 이 단계는 건너뛴다 (다음 단계는 _기울임_ 보존).
    // 8) 취소선 ~~text~~ → ~text~
    .replace(/~~([^~\n]+)~~/g, '~$1~');

  // 9) 인라인 코드 복원 `...`
  out = out.replace(/__SLACK_INLINE_CODE_(\d+)__/g, (_, idxStr: string) => {
    const idx = parseInt(idxStr, 10);
    return '`' + inlineCodes[idx] + '`';
  });

  // 10) 코드 블록 복원 ```...```
  out = out.replace(/__SLACK_CODE_BLOCK_(\d+)__/g, (_, idxStr: string) => {
    const idx = parseInt(idxStr, 10);
    return '```' + codeBlocks[idx] + '```';
  });

  return out;
}
