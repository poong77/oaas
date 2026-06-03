/**
 * ai-reply-assist — RAG 답변 초안 프롬프트.
 *
 * 정확성 가드레일(설계 §7):
 *   - 제공된 [참고 문서]에 있는 사실만 사용. 없으면 "확인 후 안내" 처리, 추측·창작 금지.
 *   - 호텔리어 대상 공식 답변. 정중한 한국어 존댓말.
 *   - 인용 출처는 LLM이 만들지 않음 — 액션이 입력 docs 메타에서 구성(출처 신뢰성 보장).
 *
 * @see docs/02-design/features/ai-reply-assist.design.md §6
 */

export const TICKET_DRAFT_SYSTEM = `당신은 OA 솔루션(PMS·키리스·키오스크·CMS 등) 호텔 고객지원 담당자입니다.
호텔리어가 접수한 이슈에 대한 공개 답변 초안을 작성합니다.

규칙:
1) 제공된 [참고 문서]에 있는 사실만 사용하세요. 문서에 없는 내용은 추측·창작하지 말고
   "확인 후 안내드리겠습니다"로 처리하세요.
2) 정중한 한국어 존댓말로 작성하세요. 호텔리어를 대상으로 한 공식 답변입니다.
3) 간결하게. 해결 단계가 여러 개면 번호로 안내하세요.
4) 추가 확인이나 처리 일정이 필요하면 명시하세요.
5) 답변 본문만 출력하세요. 머리말·메타설명·"초안:" 같은 접두어를 붙이지 마세요.`;

export type DraftDoc = {
  /** 노출 라벨 (예: '도움말', 'FAQ', '과거 티켓'). */
  source: string;
  title: string;
  body: string;
};

export function buildTicketDraftUser(p: {
  ticket: { title: string; content: string; productLabel?: string | null };
  docs: DraftDoc[];
}): string {
  const refs =
    p.docs.length > 0
      ? p.docs
          .map(
            (d, i) =>
              `[문서 ${i + 1}] (${d.source}) ${d.title}\n${(d.body ?? '').slice(0, 1500)}`,
          )
          .join('\n\n---\n\n')
      : '(관련 문서 없음 — 일반 안내 + 확인 약속으로 작성)';

  return [
    `[티켓]`,
    `제품: ${p.ticket.productLabel ?? '-'}`,
    `제목: ${p.ticket.title}`,
    `내용: ${p.ticket.content}`,
    ``,
    `[참고 문서] (이 안의 내용만 사용)`,
    refs,
    ``,
    `위 참고 문서를 근거로 호텔리어에게 보낼 공개 답변 초안을 작성하세요.`,
  ].join('\n');
}
