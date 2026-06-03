/**
 * ai-reply-assist — 티켓 답변 어시스트 검색 (Server 전용).
 *
 *   getTicketAssist(ticketId) → 관련 도움말(articles/faqs) + 유사 과거 티켓 추천.
 *   loadDraftDocs(refs)       → RAG 초안용 문서 본문 로드 (출처 메타 포함).
 *
 * 전략: 티켓 임베딩(없으면 즉석 생성) 기준 코사인 최근접. 유사도 임계값 미만 컷.
 * graceful degrade: 임베딩/키 없으면 빈 결과(추천 생략, 초안 버튼은 별도).
 *
 * @see docs/02-design/features/ai-reply-assist.design.md §4
 */

import 'server-only';
import { and, desc, eq, inArray, isNotNull, ne, sql } from 'drizzle-orm';

import { db } from '@/db';
import { articles, faqs, tickets, ticketMessages } from '@/db/schema';
import {
  embedText,
  toVectorLiteral,
  buildTicketEmbeddingInput,
} from './embeddings';
import type { DraftDoc } from '@/lib/ai/prompts/ticket-reply-drafter';
import type {
  AssistDoc,
  AssistTicket,
  TicketAssist,
} from './ticket-assist-types';

export type {
  AssistDoc,
  AssistTicket,
  TicketAssist,
  AssistDocType,
} from './ticket-assist-types';

/** 코사인 유사도 하한 (백필 후 실데이터로 튜닝). */
const THRESHOLD = 0.78;

const EMPTY: TicketAssist = { docs: [], tickets: [] };

/** 추천 검색 — 페이지 로드 시 1회 호출(서버). */
export async function getTicketAssist(ticketId: string): Promise<TicketAssist> {
  if (!db) return EMPTY;

  const [t] = await db
    .select({
      id: tickets.id,
      title: tickets.title,
      content: tickets.content,
      embedding: tickets.embedding,
    })
    .from(tickets)
    .where(eq(tickets.id, ticketId))
    .limit(1);
  if (!t) return EMPTY;

  // 임베딩 확보 (없으면 즉석 생성 후 저장)
  let lit: string | null = null;
  if (t.embedding) {
    lit = toVectorLiteral(t.embedding as unknown as number[]);
  } else {
    const vec = await embedText(
      buildTicketEmbeddingInput({ title: t.title, content: t.content }),
    );
    if (!vec) return EMPTY; // graceful degrade
    lit = toVectorLiteral(vec);
    void db.update(tickets).set({ embedding: vec }).where(eq(tickets.id, ticketId));
  }
  const q = sql`${lit}::vector`;

  const [artRows, faqRows, tkRows] = await Promise.all([
    db
      .select({
        id: articles.id,
        slug: articles.slug,
        title: articles.title,
        summary: articles.summary,
        productCode: articles.productCode,
        contentType: articles.contentType,
        sim: sql<number>`1 - (${articles.embedding} <=> ${q})`,
      })
      .from(articles)
      .where(
        and(
          eq(articles.status, 'published'),
          eq(articles.isActive, true),
          isNotNull(articles.embedding),
        ),
      )
      .orderBy(sql`${articles.embedding} <=> ${q}`)
      .limit(5),
    db
      .select({
        id: faqs.id,
        question: faqs.question,
        answerMarkdown: faqs.answerMarkdown,
        sim: sql<number>`1 - (${faqs.embedding} <=> ${q})`,
      })
      .from(faqs)
      .where(and(eq(faqs.isActive, true), isNotNull(faqs.embedding)))
      .orderBy(sql`${faqs.embedding} <=> ${q}`)
      .limit(5),
    db
      .select({
        id: tickets.id,
        ticketNo: tickets.ticketNo,
        title: tickets.title,
        status: tickets.status,
        sim: sql<number>`1 - (${tickets.embedding} <=> ${q})`,
      })
      .from(tickets)
      .where(and(ne(tickets.id, ticketId), isNotNull(tickets.embedding)))
      .orderBy(sql`${tickets.embedding} <=> ${q}`)
      .limit(3),
  ]);

  const docs: AssistDoc[] = [
    ...artRows.map((r) => ({
      type: 'article' as const,
      id: r.id,
      title: r.title,
      url: `/help/${r.productCode}/${r.contentType}/${r.slug}`,
      snippet: (r.summary ?? '').slice(0, 120),
      score: Number(r.sim),
    })),
    ...faqRows.map((r) => ({
      type: 'faq' as const,
      id: r.id,
      title: r.question,
      url: `/admin/faqs/${r.id}`,
      snippet: (r.answerMarkdown ?? '').slice(0, 120),
      score: Number(r.sim),
    })),
  ]
    .filter((d) => d.score >= THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const similar = tkRows.filter((r) => Number(r.sim) >= THRESHOLD);
  const resolutionByTicket = await loadLastPublicMessages(similar.map((r) => r.id));

  const similarTickets: AssistTicket[] = similar.map((r) => ({
    id: r.id,
    ticketNo: r.ticketNo,
    title: r.title,
    status: r.status,
    resolutionSnippet: resolutionByTicket.get(r.id) ?? '',
    url: `/admin/tickets/${r.id}`,
    score: Number(r.sim),
  }));

  return { docs, tickets: similarTickets };
}

/** 유사 티켓들의 마지막 공개 답변 일부 (해결 요약 표시용). */
async function loadLastPublicMessages(
  ticketIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!db || ticketIds.length === 0) return map;
  const rows = await db
    .select({
      ticketId: ticketMessages.ticketId,
      content: ticketMessages.content,
      createdAt: ticketMessages.createdAt,
    })
    .from(ticketMessages)
    .where(
      and(
        inArray(ticketMessages.ticketId, ticketIds),
        eq(ticketMessages.kind, 'public'),
      ),
    )
    .orderBy(desc(ticketMessages.createdAt));
  for (const r of rows) {
    if (!map.has(r.ticketId)) map.set(r.ticketId, (r.content ?? '').slice(0, 120));
  }
  return map;
}

/** RAG 초안용 — 선택 문서 본문 로드 (출처 라벨 포함). */
export async function loadDraftDocs(
  refs: { type: 'article' | 'faq' | 'ticket'; id: string }[],
): Promise<DraftDoc[]> {
  if (!db || refs.length === 0) return [];
  const out: DraftDoc[] = [];

  const articleIds = refs.filter((r) => r.type === 'article').map((r) => r.id);
  const faqIds = refs.filter((r) => r.type === 'faq').map((r) => r.id);
  const ticketIds = refs.filter((r) => r.type === 'ticket').map((r) => r.id);

  if (articleIds.length > 0) {
    const rows = await db
      .select({
        id: articles.id,
        title: articles.title,
        body: articles.bodyMarkdown,
      })
      .from(articles)
      .where(inArray(articles.id, articleIds));
    for (const r of rows)
      out.push({ source: '도움말', title: r.title, body: r.body ?? '' });
  }
  if (faqIds.length > 0) {
    const rows = await db
      .select({
        id: faqs.id,
        question: faqs.question,
        answer: faqs.answerMarkdown,
      })
      .from(faqs)
      .where(inArray(faqs.id, faqIds));
    for (const r of rows)
      out.push({ source: 'FAQ', title: r.question, body: r.answer ?? '' });
  }
  if (ticketIds.length > 0) {
    const resolution = await loadLastPublicMessages(ticketIds);
    const rows = await db
      .select({ id: tickets.id, title: tickets.title, content: tickets.content })
      .from(tickets)
      .where(inArray(tickets.id, ticketIds));
    for (const r of rows)
      out.push({
        source: '과거 티켓',
        title: r.title,
        body: `${r.content ?? ''}\n\n[해결] ${resolution.get(r.id) ?? ''}`,
      });
  }

  return out;
}
