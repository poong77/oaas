'use server';

/**
 * ai-reply-assist — RAG 답변 초안 생성 액션.
 *
 * 매니저/어드민 전용. 선택 문서를 근거로 Claude/OpenAI 초안을 생성해 반환한다.
 *   - 초안은 DB에 저장하지 않음 — 에디터 주입 전용. 발송은 기존 답변 등록 액션이 담당.
 *   - 출처(citations)는 클라이언트가 선택 문서(AssistDoc/AssistTicket)에서 직접 구성.
 *   - 사용량은 activity_logs에 fire-and-forget 기록(provider/model/docCount).
 *
 * @see docs/02-design/features/ai-reply-assist.design.md §7
 */

import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { tickets } from '@/db/schema';
import { requireRole } from '@/lib/permissions';
import { logActivity } from '@/lib/audit';
import { getActiveModelById } from '@/lib/services/ai-models';
import { loadDraftDocs } from '@/lib/services/ticket-assist';
import { generateDraft } from '@/lib/ai/draft-provider';
import {
  TICKET_DRAFT_SYSTEM,
  buildTicketDraftUser,
} from '@/lib/ai/prompts/ticket-reply-drafter';

export type GenerateDraftResult =
  | { ok: true; draft: string }
  | { ok: false; message: string };

export async function generateReplyDraftAction(input: {
  ticketId: string;
  docIds: { type: 'article' | 'faq' | 'ticket'; id: string }[];
  modelId: string;
}): Promise<GenerateDraftResult> {
  const viewer = await requireRole(['manager', 'admin']);
  if (!db) return { ok: false, message: 'DB 연결이 준비되지 않았습니다.' };

  const model = await getActiveModelById(input.modelId);
  if (!model) return { ok: false, message: '사용할 수 없는 모델입니다.' };

  const [ticket] = await db
    .select({
      title: tickets.title,
      content: tickets.content,
      productCode: tickets.productCode,
    })
    .from(tickets)
    .where(eq(tickets.id, input.ticketId))
    .limit(1);
  if (!ticket) return { ok: false, message: '티켓을 찾을 수 없습니다.' };

  const docs = await loadDraftDocs(input.docIds ?? []);
  const user = buildTicketDraftUser({
    ticket: {
      title: ticket.title,
      content: ticket.content,
      productLabel: ticket.productCode,
    },
    docs,
  });

  let draft: string;
  try {
    draft = await generateDraft({
      provider: model.provider,
      model: model.code,
      system: TICKET_DRAFT_SYSTEM,
      user,
    });
  } catch (err) {
    console.error('[generateReplyDraftAction] 초안 생성 실패:', err);
    return {
      ok: false,
      message: '초안 생성에 실패했습니다. 잠시 후 다시 시도해주세요.',
    };
  }

  logActivity({
    userId: viewer.id,
    action: 'ai.draft_generated',
    targetType: 'ticket',
    targetId: input.ticketId,
    payload: {
      provider: model.provider,
      model: model.code,
      docCount: docs.length,
    },
  });

  return { ok: true, draft };
}
