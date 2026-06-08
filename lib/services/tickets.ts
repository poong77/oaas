/**
 * tickets 데이터 액세스 + 발급 + 알림 트리거 (Server 전용).
 *
 * Phase 5 IC-01~IC-08 / IS-01~IS-02 / IS-04.
 *
 * 핵심 함수:
 *   - generateTicketNo()           — 'AS-YYYY-NNNNNN' 발급. ticket_no_counter 테이블 atomic UPSERT (race-free)
 *   - createTicket(input)          — 티켓 생성 + 첨부 매핑 + 알림 일괄 (Slack/SMS/Email)
 *   - listTickets({...})           — 큐·내 문의 공용 (권한별 필터는 호출부에서)
 *   - getTicketById(id, viewer)    — 상세 + 메시지 + 첨부 (viewer가 호텔리어면 internal_memo 제외)
 *   - addMessage({...})            — 답변/내부 메모 추가
 *   - changeStatus({...})          — 상태 전환 + status_change 메시지 자동
 *   - assignTicket({...})          — 담당자 배정
 *   - escalateToDev({...})         — Slack #dev-escalation 발송 + 메시지 기록
 */

import 'server-only';
import { after } from 'next/server';
import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';

import { db } from '@/db';
import {
  hotels,
  tickets,
  ticketMessages,
  ticketAttachments,
  ticketFeedback,
  users,
  categories,
  type Ticket,
  type TicketMessage,
  type TicketAttachment,
  type TicketFeedback,
  type TicketFeedbackRating,
  type TicketStatus,
  type TicketChannel,
  type TicketContactMethod,
  type TicketMessageKind,
  type NewTicket,
  type NewTicketMessage,
  type NewTicketAttachment,
  type NewTicketFeedback,
} from '@/db/schema';
import { getPublicBaseUrl } from '@/lib/env';
import { notifyEmail, notifySlack, notifySms } from '@/lib/notifications';
import {
  buildTicketCompleted,
  buildTicketInProgress,
  buildTicketReceived,
} from '@/lib/notifications/templates';
import {
  buildTicketEscalateBlocks,
  buildTicketNewBlocks,
  buildTicketUrgentBlocks,
  type TicketSummaryForSlack,
} from '@/lib/notifications/slack';
import {
  embedText,
  buildTicketEmbeddingInput,
} from './embeddings';

/**
 * ai-reply-assist — 티켓 임베딩 생성/갱신 (fire-and-forget 권장).
 * OPENAI_API_KEY 미설정/오류 시 embedText가 null → 갱신 생략(graceful degrade).
 * 추천 검색은 embedding이 채워진 뒤부터 동작하며, 누락분은 db:backfill-ticket-embeddings로 보정.
 */
export async function updateTicketEmbedding(
  ticketId: string,
  input: { title: string; content: string },
): Promise<void> {
  if (!db) return;
  try {
    const vec = await embedText(buildTicketEmbeddingInput(input));
    if (!vec) return;
    await db.update(tickets).set({ embedding: vec }).where(eq(tickets.id, ticketId));
  } catch (err) {
    console.warn(
      `[tickets.updateTicketEmbedding] ${ticketId} 실패(무시):`,
      err instanceof Error ? err.message : err,
    );
  }
}

// AuthorizedUser는 lib/permissions.ts에서 사용 — schema에는 없어 별도 import.
// 순환 import 회피 위해 inline 타입 사용.
type ViewerLike = {
  id: string;
  role: 'hotelier' | 'manager' | 'admin';
  hotelId: string | null;
};

// ─────────────────────────────────────────────────────────────────────
// 라벨 헬퍼 (categories.code → label)
// ─────────────────────────────────────────────────────────────────────

type CategoryLabelMap = Record<string, string>;

export async function loadCategoryLabelMaps(): Promise<{
  product: CategoryLabelMap;
  issueType: CategoryLabelMap;
  urgency: CategoryLabelMap;
  impact: CategoryLabelMap;
}> {
  const empty: {
    product: Record<string, string>;
    issueType: Record<string, string>;
    urgency: Record<string, string>;
    impact: Record<string, string>;
  } = { product: {}, issueType: {}, urgency: {}, impact: {} };
  if (!db) return empty;
  try {
    const rows = await db
      .select({
        type: categories.type,
        code: categories.code,
        label: categories.label,
      })
      .from(categories);
    const out = { ...empty };
    for (const r of rows) {
      if (r.type === 'product') out.product[r.code] = r.label;
      else if (r.type === 'issue_type') out.issueType[r.code] = r.label;
      else if (r.type === 'urgency') out.urgency[r.code] = r.label;
      else if (r.type === 'impact') out.impact[r.code] = r.label;
    }
    return out;
  } catch (err) {
    console.error('[tickets.loadCategoryLabelMaps] 실패:', err);
    return empty;
  }
}

export { STATUS_LABEL } from './tickets-meta';
import { STATUS_LABEL } from './tickets-meta';

// ─────────────────────────────────────────────────────────────────────
// 티켓 번호 발급
// ─────────────────────────────────────────────────────────────────────

/**
 * 'AS-YYYY-NNNNNN' atomic 채번.
 *
 * ticket_no_counter(year, last_no) 테이블에 INSERT ... ON CONFLICT DO UPDATE RETURNING으로
 * Postgres 단일 statement 내에서 atomic increment. Neon read replica lag 무관.
 * 연도별 독립 카운터 — 새해 자동으로 1부터 시작.
 */
export async function generateTicketNo(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `AS-${year}-`;
  if (!db) {
    return `${prefix}000001`;
  }

  try {
    const rows = (await db.execute(
      sql`
        INSERT INTO ticket_no_counter (year, last_no)
        VALUES (${year}, 1)
        ON CONFLICT (year) DO UPDATE
          SET last_no = ticket_no_counter.last_no + 1
        RETURNING last_no
      `,
    )) as unknown as { rows: Array<{ last_no: number }> } | Array<{ last_no: number }>;
    // node-postgres drizzle은 { rows: ... }로 감싸 반환 (이전 neon-http는 배열 직반환).
    // 두 형태 모두 안전하게 흡수.
    const arr = Array.isArray(rows)
      ? rows
      : (rows as { rows: Array<{ last_no: number }> }).rows;
    const next = Number(arr?.[0]?.last_no ?? 0);
    if (!next || next <= 0) {
      throw new Error('ticket_no_counter returned invalid last_no');
    }
    return `${prefix}${String(next).padStart(6, '0')}`;
  } catch (err) {
    console.error('[tickets.generateTicketNo] atomic UPSERT 실패:', err);
    // 최후 fallback: timestamp 기반 (충돌 가능하나 retry로 흡수)
    return `${prefix}${String(Date.now() % 1000000).padStart(6, '0')}`;
  }
}

// ─────────────────────────────────────────────────────────────────────
// 신규 접수
// ─────────────────────────────────────────────────────────────────────

export type CreateTicketInput = {
  hotelId: string | null;
  reporterId: string | null;
  productCode: string;
  issueType: string;
  urgency: string;
  impactScope?: string | null;
  title: string;
  /** markdown */
  content: string;
  customFields?: Record<string, unknown>;
  channel?: TicketChannel;
  contactMethods?: TicketContactMethod[];
  /** Vercel Blob에 이미 업로드된 첨부 메타. 티켓 생성 시 ticketId 매핑. */
  attachments?: Array<{
    blobUrl: string;
    pathname: string;
    originalName: string;
    mimeType?: string | null;
    sizeBytes: number;
  }>;
};

export type CreateTicketResult =
  | {
      ok: true;
      ticketId: string;
      ticketNo: string;
    }
  | { ok: false; message: string };

export async function createTicket(
  input: CreateTicketInput,
): Promise<CreateTicketResult> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };

  // ticket_no_counter atomic UPSERT가 race-free이므로 재시도 불필요.
  // fallback timestamp 채번이 충돌할 극단적 케이스에만 1회 더 시도.
  const MAX_INSERT_ATTEMPTS = 2;
  let created: { id: string; ticketNo: string } | undefined;
  let lastErr: unknown = null;

  for (let attempt = 0; attempt < MAX_INSERT_ATTEMPTS; attempt++) {
    const ticketNo = await generateTicketNo();
    const values: NewTicket = {
      ticketNo,
      hotelId: input.hotelId,
      reporterId: input.reporterId,
      productCode: input.productCode,
      issueType: input.issueType,
      urgency: input.urgency,
      impactScope: input.impactScope ?? null,
      title: input.title,
      content: input.content,
      customFields: input.customFields ?? {},
      channel: input.channel ?? 'web',
      contactMethods: input.contactMethods ?? [],
      status: 'received',
    };

    try {
      const [row] = await db
        .insert(tickets)
        .values(values)
        .returning({ id: tickets.id, ticketNo: tickets.ticketNo });
      if (!row) {
        return { ok: false, message: 'INSERT_FAILED' };
      }
      created = row;
      break;
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      const isDup =
        msg.includes('tickets_ticket_no_uq') ||
        msg.includes('duplicate key value');
      if (!isDup) {
        console.error('[tickets.createTicket] INSERT 실패:', err);
        return { ok: false, message: msg || 'INTERNAL_ERROR' };
      }
      console.warn(
        `[tickets.createTicket] ticket_no 충돌 재시도 ${attempt + 1}/${MAX_INSERT_ATTEMPTS}: ${ticketNo} (fallback timestamp 채번 충돌 가능성)`,
      );
    }
  }

  if (!created) {
    console.error(
      '[tickets.createTicket] 재시도 한계 초과, 마지막 에러:',
      lastErr,
    );
    return { ok: false, message: 'TICKET_NO_CONFLICT' };
  }

  try {
    // 첨부 매핑
    if (input.attachments && input.attachments.length > 0) {
      const attachmentRows: NewTicketAttachment[] = input.attachments.map(
        (a) => ({
          ticketId: created!.id,
          blobUrl: a.blobUrl,
          pathname: a.pathname,
          originalName: a.originalName,
          mimeType: a.mimeType ?? null,
          sizeBytes: a.sizeBytes,
          uploaderId: input.reporterId,
        }),
      );
      await db.insert(ticketAttachments).values(attachmentRows);
    }

    // 시스템 메시지 1건 — 접수 사실 기록
    await db.insert(ticketMessages).values({
      ticketId: created.id,
      authorId: input.reporterId,
      kind: 'system',
      content: '티켓이 접수되었습니다.',
      metadata: { eventKey: 'ticket.received' },
    });

    // 알림 — 응답 반환 후 실행(after). Vercel 서버리스에서 void 던지면 함수가 동결되어
    // 대기 중이던 Slack/SMS/Email fetch가 유실됨 → after()로 응답 후까지 살려둔다.
    const createdId = created.id;
    const createdNo = created.ticketNo;
    after(() => dispatchTicketReceivedNotifications(createdId, createdNo));

    // ai-reply-assist — 시맨틱 추천용 임베딩 생성 (실패해도 접수 정상)
    after(() =>
      updateTicketEmbedding(createdId, {
        title: input.title,
        content: input.content,
      }),
    );

    return { ok: true, ticketId: created.id, ticketNo: created.ticketNo };
  } catch (err) {
    console.error('[tickets.createTicket] 후속 작업 실패:', err);
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'INTERNAL_ERROR',
    };
  }
}

/**
 * 접수 직후 SMS·Email·Slack 알림 발송 (별도 트랜잭션 외부에서).
 * 실패해도 메인 로직에는 영향 없음.
 */
async function dispatchTicketReceivedNotifications(
  ticketId: string,
  ticketNo: string,
): Promise<void> {
  if (!db) return;
  try {
    const ticketRow = await getTicketRaw(ticketId);
    if (!ticketRow) return;

    const labels = await loadCategoryLabelMaps();
    const productLabel = labels.product[ticketRow.productCode] ?? ticketRow.productCode;
    const issueTypeLabel = labels.issueType[ticketRow.issueType] ?? ticketRow.issueType;
    const urgencyLabel = labels.urgency[ticketRow.urgency] ?? ticketRow.urgency;
    const impactLabel = ticketRow.impactScope
      ? (labels.impact[ticketRow.impactScope] ?? ticketRow.impactScope)
      : null;

    // 호텔명·접수자 정보
    let hotelName: string | null = null;
    let reporterName: string | null = null;
    let reporterEmail: string | null = null;
    let reporterPhone: string | null = null;
    if (ticketRow.hotelId) {
      const h = await db
        .select({ name: hotels.name })
        .from(hotels)
        .where(eq(hotels.id, ticketRow.hotelId))
        .limit(1);
      hotelName = h[0]?.name ?? null;
    }
    if (ticketRow.reporterId) {
      const u = await db
        .select({
          name: users.name,
          email: users.email,
          phone: users.phone,
        })
        .from(users)
        .where(eq(users.id, ticketRow.reporterId))
        .limit(1);
      reporterName = u[0]?.name ?? null;
      reporterEmail = u[0]?.email ?? null;
      reporterPhone = u[0]?.phone ?? null;
    }

    // 첨부 개수
    const attachmentRows = await db
      .select({ id: ticketAttachments.id })
      .from(ticketAttachments)
      .where(eq(ticketAttachments.ticketId, ticketId));
    const attachmentCount = attachmentRows.length;

    const baseUrl = getPublicBaseUrl();
    const ticketUrl = `${baseUrl.replace(/\/$/, '')}/tickets/${ticketId}`;
    const adminTicketUrl = `${baseUrl.replace(/\/$/, '')}/admin/tickets/${ticketId}`;

    // ── 호텔리어 SMS/Email (contactMethods 따라) ──────────────────
    const contactMethods = Array.isArray(ticketRow.contactMethods)
      ? ticketRow.contactMethods
      : [];
    if (
      reporterName &&
      (contactMethods.includes('email') || contactMethods.includes('sms'))
    ) {
      const tpl = buildTicketReceived({
        reporterName,
        ticketNo,
        title: ticketRow.title,
        productLabel,
        issueTypeLabel,
        urgencyLabel,
        ticketUrl,
      });
      if (contactMethods.includes('email') && reporterEmail) {
        await notifyEmail(
          {
            to: reporterEmail,
            subject: tpl.subject,
            html: tpl.html,
            text: tpl.text,
          },
          { eventKey: 'ticket.received', ticketId },
        );
      }
      if (contactMethods.includes('sms') && reporterPhone) {
        await notifySms(
          { to: reporterPhone, text: tpl.sms },
          { eventKey: 'ticket.received', ticketId },
        );
      }
    }

    // ── Slack 알림 ──────────────────────────────────────────────
    const summary: TicketSummaryForSlack = {
      ticketNo,
      title: ticketRow.title,
      productLabel,
      issueTypeLabel,
      urgencyLabel,
      impactLabel,
      hotelName,
      reporterName,
      reporterEmail,
      reporterPhone,
      contentExcerpt: ticketRow.content.slice(0, 400),
      attachmentCount,
      link: adminTicketUrl,
    };

    await notifySlack(
      {
        channel: 'new',
        fallbackText: `[새 티켓] ${ticketNo} ${ticketRow.title}`,
        blocks: buildTicketNewBlocks(summary),
      },
      { eventKey: 'ticket.new_slack', ticketId },
    );

    if (ticketRow.urgency === 'p1') {
      await notifySlack(
        {
          channel: 'urgent',
          fallbackText: `[P1 긴급] ${ticketNo} ${ticketRow.title}`,
          blocks: buildTicketUrgentBlocks(summary),
        },
        { eventKey: 'ticket.urgent_slack', ticketId },
      );
    }
  } catch (err) {
    console.warn(
      '[tickets.dispatchTicketReceivedNotifications] 실패:',
      err instanceof Error ? err.message : err,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────
// 조회
// ─────────────────────────────────────────────────────────────────────

async function getTicketRaw(id: string): Promise<Ticket | null> {
  if (!db) return null;
  try {
    const rows = await db
      .select()
      .from(tickets)
      .where(eq(tickets.id, id))
      .limit(1);
    return rows[0] ?? null;
  } catch (err) {
    console.error('[tickets.getTicketRaw] 실패:', err);
    return null;
  }
}

export type TicketListItem = Pick<
  Ticket,
  | 'id'
  | 'ticketNo'
  | 'title'
  | 'productCode'
  | 'issueType'
  | 'urgency'
  | 'impactScope'
  | 'status'
  | 'channel'
  | 'createdAt'
  | 'updatedAt'
  | 'dueDate'
  | 'reporterId'
  | 'assigneeId'
  | 'hotelId'
> & {
  hotelName: string | null;
  reporterName: string | null;
  assigneeName: string | null;
  /** 공개 메시지(=답변) 카운트. */
  messageCount: number;
};

export type ListTicketsParams = {
  q?: string;
  status?: TicketStatus | 'all';
  productCode?: string;
  issueType?: string;
  urgency?: string;
  assigneeId?: string | 'unassigned' | 'mine';
  /** 호텔리어/내 문의 보기 — reporter_id 또는 hotel_id 기반. */
  reporterId?: string;
  hotelId?: string;
  sortBy?: 'created_at' | 'updated_at' | 'urgency' | 'due_date';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
};

export type ListTicketsResult = {
  items: TicketListItem[];
  total: number;
  page: number;
  pageSize: number;
};

export async function listTickets(
  params: ListTicketsParams = {},
  viewer?: ViewerLike,
): Promise<ListTicketsResult> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(5, params.pageSize ?? 20));
  const offset = (page - 1) * pageSize;
  if (!db) return { items: [], total: 0, page, pageSize };

  const conditions: SQL[] = [eq(tickets.isActive, true)];

  if (params.status && params.status !== 'all') {
    conditions.push(eq(tickets.status, params.status));
  }
  if (params.productCode) conditions.push(eq(tickets.productCode, params.productCode));
  if (params.issueType) conditions.push(eq(tickets.issueType, params.issueType));
  if (params.urgency) conditions.push(eq(tickets.urgency, params.urgency));

  if (params.assigneeId === 'unassigned') {
    conditions.push(sql`${tickets.assigneeId} IS NULL`);
  } else if (params.assigneeId === 'mine' && viewer) {
    conditions.push(eq(tickets.assigneeId, viewer.id));
  } else if (
    params.assigneeId &&
    params.assigneeId !== 'mine' &&
    params.assigneeId !== 'unassigned'
  ) {
    conditions.push(eq(tickets.assigneeId, params.assigneeId));
  }

  if (params.reporterId) {
    conditions.push(eq(tickets.reporterId, params.reporterId));
  }
  if (params.hotelId) {
    conditions.push(eq(tickets.hotelId, params.hotelId));
  }

  if (params.q && params.q.trim()) {
    const pattern = `%${params.q.trim()}%`;
    const search = or(
      ilike(tickets.title, pattern),
      ilike(tickets.ticketNo, pattern),
      ilike(tickets.content, pattern),
    );
    if (search) conditions.push(search);
  }

  const whereExpr =
    conditions.length === 0
      ? undefined
      : conditions.length === 1
        ? conditions[0]
        : and(...conditions);

  const sortColumn =
    params.sortBy === 'updated_at'
      ? tickets.updatedAt
      : params.sortBy === 'urgency'
        ? tickets.urgency
        : params.sortBy === 'due_date'
          ? tickets.dueDate
          : tickets.createdAt;
  const orderExpr =
    (params.sortOrder ?? 'desc') === 'asc'
      ? asc(sortColumn)
      : desc(sortColumn);

  try {
    // 메인 조회 (조인 4개)
    const reporters = users; // alias
    // alias 위한 SQL 작성 (drizzle alias 사용)
    // 같은 users 테이블에 두 번 조인할 수 있으나 코드 단순화를 위해 별도 쿼리로 assignee 이름 lookup.
    const items = await db
      .select({
        id: tickets.id,
        ticketNo: tickets.ticketNo,
        title: tickets.title,
        productCode: tickets.productCode,
        issueType: tickets.issueType,
        urgency: tickets.urgency,
        impactScope: tickets.impactScope,
        status: tickets.status,
        channel: tickets.channel,
        createdAt: tickets.createdAt,
        updatedAt: tickets.updatedAt,
        dueDate: tickets.dueDate,
        reporterId: tickets.reporterId,
        assigneeId: tickets.assigneeId,
        hotelId: tickets.hotelId,
        hotelName: hotels.name,
        reporterName: reporters.name,
      })
      .from(tickets)
      .leftJoin(hotels, eq(tickets.hotelId, hotels.id))
      .leftJoin(reporters, eq(tickets.reporterId, reporters.id))
      .where(whereExpr)
      .orderBy(orderExpr, desc(tickets.createdAt))
      .limit(pageSize)
      .offset(offset);

    // assignee 이름 매핑
    const assigneeIds = Array.from(
      new Set(items.map((it) => it.assigneeId).filter((v): v is string => !!v)),
    );
    const assigneeMap: Record<string, string> = {};
    if (assigneeIds.length > 0) {
      const rows = await db
        .select({ id: users.id, name: users.name })
        .from(users)
        .where(inArray(users.id, assigneeIds));
      for (const r of rows) assigneeMap[r.id] = r.name;
    }

    // 메시지 카운트 (kind=public만)
    const ids = items.map((it) => it.id);
    const messageCountMap: Record<string, number> = {};
    if (ids.length > 0) {
      const rows = await db
        .select({
          ticketId: ticketMessages.ticketId,
          count: sql<number>`count(*)::int`,
        })
        .from(ticketMessages)
        .where(
          and(
            eq(ticketMessages.kind, 'public'),
            eq(ticketMessages.isActive, true),
            inArray(ticketMessages.ticketId, ids),
          ),
        )
        .groupBy(ticketMessages.ticketId);
      for (const r of rows) messageCountMap[r.ticketId] = Number(r.count);
    }

    const totalRows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tickets)
      .where(whereExpr);
    const total = Number(totalRows[0]?.count ?? 0);

    return {
      items: items.map((it) => ({
        ...it,
        assigneeName: it.assigneeId ? (assigneeMap[it.assigneeId] ?? null) : null,
        messageCount: messageCountMap[it.id] ?? 0,
      })),
      total,
      page,
      pageSize,
    };
  } catch (err) {
    console.error('[tickets.listTickets] 실패:', err);
    return { items: [], total: 0, page, pageSize };
  }
}

export type TicketDetail = Ticket & {
  hotelName: string | null;
  reporterName: string | null;
  reporterEmail: string | null;
  reporterPhone: string | null;
  assigneeName: string | null;
  messages: Array<TicketMessage & { authorName: string | null; authorRole: string | null }>;
  attachments: TicketAttachment[];
};

/**
 * id 기준 상세. viewer가 호텔리어면 internal_memo 메시지 자동 제외.
 */
export async function getTicketDetail(
  id: string,
  viewer?: ViewerLike,
): Promise<TicketDetail | null> {
  if (!db) return null;
  try {
    const ticketRow = await getTicketRaw(id);
    if (!ticketRow) return null;

    // 호텔리어 권한 체크 (본인 또는 같은 호텔)
    if (viewer?.role === 'hotelier') {
      const ownsByReporter = ticketRow.reporterId === viewer.id;
      const ownsByHotel =
        viewer.hotelId !== null &&
        ticketRow.hotelId !== null &&
        ticketRow.hotelId === viewer.hotelId;
      if (!ownsByReporter && !ownsByHotel) {
        return null;
      }
    }

    // 호텔명·접수자·담당자
    let hotelName: string | null = null;
    let reporterName: string | null = null;
    let reporterEmail: string | null = null;
    let reporterPhone: string | null = null;
    let assigneeName: string | null = null;

    if (ticketRow.hotelId) {
      const h = await db
        .select({ name: hotels.name })
        .from(hotels)
        .where(eq(hotels.id, ticketRow.hotelId))
        .limit(1);
      hotelName = h[0]?.name ?? null;
    }
    if (ticketRow.reporterId) {
      const u = await db
        .select({
          name: users.name,
          email: users.email,
          phone: users.phone,
        })
        .from(users)
        .where(eq(users.id, ticketRow.reporterId))
        .limit(1);
      reporterName = u[0]?.name ?? null;
      reporterEmail = u[0]?.email ?? null;
      reporterPhone = u[0]?.phone ?? null;
    }
    if (ticketRow.assigneeId) {
      const u = await db
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, ticketRow.assigneeId))
        .limit(1);
      assigneeName = u[0]?.name ?? null;
    }

    // 메시지 (kind 필터)
    const allowedKinds: TicketMessageKind[] =
      viewer?.role === 'hotelier'
        ? ['public', 'status_change']
        : ['public', 'internal_memo', 'status_change', 'system'];
    const messageRows = await db
      .select({
        message: ticketMessages,
        authorName: users.name,
        authorRole: users.role,
      })
      .from(ticketMessages)
      .leftJoin(users, eq(ticketMessages.authorId, users.id))
      .where(
        and(
          eq(ticketMessages.ticketId, id),
          eq(ticketMessages.isActive, true),
          inArray(ticketMessages.kind, allowedKinds),
        ),
      )
      .orderBy(asc(ticketMessages.createdAt));

    // 첨부
    const attachmentRows = await db
      .select()
      .from(ticketAttachments)
      .where(
        and(
          eq(ticketAttachments.ticketId, id),
          eq(ticketAttachments.isActive, true),
        ),
      )
      .orderBy(asc(ticketAttachments.createdAt));

    return {
      ...ticketRow,
      hotelName,
      reporterName,
      reporterEmail,
      reporterPhone,
      assigneeName,
      messages: messageRows.map((r) => ({
        ...r.message,
        authorName: r.authorName,
        authorRole: r.authorRole,
      })),
      attachments: attachmentRows,
    };
  } catch (err) {
    console.error('[tickets.getTicketDetail] 실패:', err);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────
// 메시지 / 상태 / 담당자 / 에스컬
// ─────────────────────────────────────────────────────────────────────

export type AddMessageInput = {
  ticketId: string;
  authorId: string;
  kind: TicketMessageKind;
  content: string;
};

export async function addMessage(
  input: AddMessageInput,
): Promise<{ ok: boolean; messageId?: string; message?: string }> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  try {
    const row: NewTicketMessage = {
      ticketId: input.ticketId,
      authorId: input.authorId,
      kind: input.kind,
      content: input.content,
      metadata: {},
    };
    const [created] = await db
      .insert(ticketMessages)
      .values(row)
      .returning({ id: ticketMessages.id });
    // 티켓 updated_at 갱신 위해 명시적 update
    await db
      .update(tickets)
      .set({ updatedAt: new Date() })
      .where(eq(tickets.id, input.ticketId));
    return { ok: true, messageId: created?.id };
  } catch (err) {
    console.error('[tickets.addMessage] 실패:', err);
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'INTERNAL_ERROR',
    };
  }
}

export type ChangeStatusInput = {
  ticketId: string;
  actorId: string;
  nextStatus: TicketStatus;
  /** DI-01: 완료 전환 시 "원콜 해결"(1회 작업 해결) 기록. completed일 때만 반영. */
  oneCallResolved?: boolean;
};

export async function changeStatus(
  input: ChangeStatusInput,
): Promise<{ ok: boolean; message?: string }> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  try {
    const current = await getTicketRaw(input.ticketId);
    if (!current) return { ok: false, message: 'NOT_FOUND' };
    if (
      current.status === input.nextStatus &&
      input.oneCallResolved === undefined
    ) {
      return { ok: true };
    }
    const patch: Partial<NewTicket> = { status: input.nextStatus };
    // 완료로 전환할 때만 원콜 여부 기록 (다른 상태로 가면 건드리지 않음).
    if (input.nextStatus === 'completed' && input.oneCallResolved !== undefined) {
      patch.oneCallResolved = input.oneCallResolved;
    }
    await db.update(tickets).set(patch).where(eq(tickets.id, input.ticketId));
    if (current.status === input.nextStatus) {
      // 상태는 그대로(완료 유지)고 원콜 플래그만 갱신한 경우 — 메시지/알림 없이 종료.
      return { ok: true };
    }

    await db.insert(ticketMessages).values({
      ticketId: input.ticketId,
      authorId: input.actorId,
      kind: 'status_change',
      content: `${STATUS_LABEL[current.status]} → ${STATUS_LABEL[input.nextStatus]}`,
      metadata: { from: current.status, to: input.nextStatus },
    });

    // 호텔리어 알림 (in_progress / completed) — after()로 응답 후 발송(Vercel 동결 방지)
    const statusTicketId = input.ticketId;
    const statusFrom = current.status;
    const statusTo = input.nextStatus;
    after(() =>
      dispatchStatusChangeNotifications(statusTicketId, statusFrom, statusTo),
    );

    return { ok: true };
  } catch (err) {
    console.error('[tickets.changeStatus] 실패:', err);
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'INTERNAL_ERROR',
    };
  }
}

async function dispatchStatusChangeNotifications(
  ticketId: string,
  from: TicketStatus,
  to: TicketStatus,
): Promise<void> {
  if (!db) return;
  // in_progress / completed만 호텔리어에게 알림
  if (to !== 'in_progress' && to !== 'completed') return;
  try {
    const t = await getTicketRaw(ticketId);
    if (!t || !t.reporterId) return;
    const reporter = await db
      .select({
        name: users.name,
        email: users.email,
        phone: users.phone,
      })
      .from(users)
      .where(eq(users.id, t.reporterId))
      .limit(1);
    const r = reporter[0];
    if (!r) return;

    const contactMethods = Array.isArray(t.contactMethods) ? t.contactMethods : [];
    const baseUrl = getPublicBaseUrl();
    const ticketUrl = `${baseUrl.replace(/\/$/, '')}/tickets/${ticketId}`;

    let assigneeName: string | null = null;
    if (t.assigneeId) {
      const a = await db
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, t.assigneeId))
        .limit(1);
      assigneeName = a[0]?.name ?? null;
    }

    const baseVars = {
      reporterName: r.name,
      ticketNo: t.ticketNo,
      title: t.title,
      fromLabel: STATUS_LABEL[from],
      toLabel: STATUS_LABEL[to],
      ticketUrl,
      managerName: assigneeName,
    };
    const tpl =
      to === 'in_progress'
        ? buildTicketInProgress(baseVars)
        : buildTicketCompleted(baseVars);
    const eventKey = `ticket.${to}`;

    if (contactMethods.includes('email') && r.email) {
      await notifyEmail(
        {
          to: r.email,
          subject: tpl.subject,
          html: tpl.html,
          text: tpl.text,
        },
        { eventKey, ticketId },
      );
    }
    if (contactMethods.includes('sms') && r.phone) {
      await notifySms(
        { to: r.phone, text: tpl.sms },
        { eventKey, ticketId },
      );
    }
  } catch (err) {
    console.warn(
      '[tickets.dispatchStatusChangeNotifications] 실패:',
      err instanceof Error ? err.message : err,
    );
  }
}

export type AssignTicketInput = {
  ticketId: string;
  actorId: string;
  assigneeId: string | null;
  dueDate?: Date | null;
};

export async function assignTicket(
  input: AssignTicketInput,
): Promise<{ ok: boolean; message?: string }> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  try {
    const current = await getTicketRaw(input.ticketId);
    if (!current) return { ok: false, message: 'NOT_FOUND' };
    await db
      .update(tickets)
      .set({
        assigneeId: input.assigneeId,
        dueDate: input.dueDate ?? current.dueDate,
      })
      .where(eq(tickets.id, input.ticketId));

    // 시스템 메시지로 기록 (kind=system)
    let label: string;
    if (input.assigneeId === null) {
      label = '담당자 배정이 해제되었습니다.';
    } else if (current.assigneeId === input.assigneeId) {
      label = '담당자 정보가 갱신되었습니다.';
    } else {
      label = '담당자가 변경되었습니다.';
    }
    await db.insert(ticketMessages).values({
      ticketId: input.ticketId,
      authorId: input.actorId,
      kind: 'system',
      content: label,
      metadata: {
        eventKey: 'ticket.assignee_change',
        from: current.assigneeId,
        to: input.assigneeId,
      },
    });

    return { ok: true };
  } catch (err) {
    console.error('[tickets.assignTicket] 실패:', err);
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'INTERNAL_ERROR',
    };
  }
}

export type EscalateToDevInput = {
  ticketId: string;
  actorId: string;
  reason: string;
};

export async function escalateToDev(
  input: EscalateToDevInput,
): Promise<{ ok: boolean; message?: string }> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  try {
    const t = await getTicketRaw(input.ticketId);
    if (!t) return { ok: false, message: 'NOT_FOUND' };

    const labels = await loadCategoryLabelMaps();
    const productLabel = labels.product[t.productCode] ?? t.productCode;
    const issueTypeLabel = labels.issueType[t.issueType] ?? t.issueType;
    const urgencyLabel = labels.urgency[t.urgency] ?? t.urgency;
    const impactLabel = t.impactScope
      ? (labels.impact[t.impactScope] ?? t.impactScope)
      : null;

    let hotelName: string | null = null;
    if (t.hotelId) {
      const h = await db
        .select({ name: hotels.name })
        .from(hotels)
        .where(eq(hotels.id, t.hotelId))
        .limit(1);
      hotelName = h[0]?.name ?? null;
    }
    let reporterName: string | null = null;
    let reporterEmail: string | null = null;
    let reporterPhone: string | null = null;
    if (t.reporterId) {
      const u = await db
        .select({
          name: users.name,
          email: users.email,
          phone: users.phone,
        })
        .from(users)
        .where(eq(users.id, t.reporterId))
        .limit(1);
      reporterName = u[0]?.name ?? null;
      reporterEmail = u[0]?.email ?? null;
      reporterPhone = u[0]?.phone ?? null;
    }

    let escalatorName: string | null = null;
    const ec = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, input.actorId))
      .limit(1);
    escalatorName = ec[0]?.name ?? null;

    const baseUrl = getPublicBaseUrl();
    const adminTicketUrl = `${baseUrl.replace(/\/$/, '')}/admin/tickets/${input.ticketId}`;

    // Slack 발송
    await notifySlack(
      {
        channel: 'dev',
        fallbackText: `[Dev 에스컬] ${t.ticketNo} ${t.title}`,
        blocks: buildTicketEscalateBlocks({
          ticketNo: t.ticketNo,
          title: t.title,
          productLabel,
          issueTypeLabel,
          urgencyLabel,
          impactLabel,
          hotelName,
          reporterName,
          reporterEmail,
          reporterPhone,
          contentExcerpt: t.content.slice(0, 400),
          attachmentCount: 0,
          link: adminTicketUrl,
          escalatorName,
          reason: input.reason,
        }),
      },
      { eventKey: 'ticket.escalated_dev', ticketId: input.ticketId },
    );

    // 내부 메모로 에스컬 이력 기록
    await db.insert(ticketMessages).values({
      ticketId: input.ticketId,
      authorId: input.actorId,
      kind: 'internal_memo',
      content: `🛠 **Dev 에스컬레이션 발송됨**\n\n${input.reason}`,
      metadata: { eventKey: 'ticket.escalated_dev' },
    });

    return { ok: true };
  } catch (err) {
    console.error('[tickets.escalateToDev] 실패:', err);
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'INTERNAL_ERROR',
    };
  }
}

// ─────────────────────────────────────────────────────────────────────
// 요약 통계 (큐 상단 카드)
// ─────────────────────────────────────────────────────────────────────

export async function getTicketQueueSummary(): Promise<{
  p1Urgent: number;
  inProgress: number;
  pending: number;
  todayCompleted: number;
}> {
  const empty = { p1Urgent: 0, inProgress: 0, pending: 0, todayCompleted: 0 };
  if (!db) return empty;
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [p1Row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tickets)
      .where(
        and(
          eq(tickets.isActive, true),
          eq(tickets.urgency, 'p1'),
          inArray(tickets.status, ['received', 'in_progress']),
        ),
      );
    const [inProgressRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tickets)
      .where(
        and(
          eq(tickets.isActive, true),
          eq(tickets.status, 'in_progress'),
        ),
      );
    const [pendingRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tickets)
      .where(
        and(eq(tickets.isActive, true), eq(tickets.status, 'received')),
      );
    const [todayDoneRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tickets)
      .where(
        and(
          eq(tickets.isActive, true),
          eq(tickets.status, 'completed'),
          sql`${tickets.updatedAt} >= ${today.toISOString()}`,
        ),
      );

    return {
      p1Urgent: Number(p1Row?.count ?? 0),
      inProgress: Number(inProgressRow?.count ?? 0),
      pending: Number(pendingRow?.count ?? 0),
      todayCompleted: Number(todayDoneRow?.count ?? 0),
    };
  } catch (err) {
    console.error('[tickets.getTicketQueueSummary] 실패:', err);
    return empty;
  }
}

// ─────────────────────────────────────────────────────────────────────
// IS-04 칸반뷰: 컬럼별 그룹핑 조회 (Phase 6)
// ─────────────────────────────────────────────────────────────────────

export type TicketKanbanCard = Pick<
  Ticket,
  | 'id'
  | 'ticketNo'
  | 'title'
  | 'productCode'
  | 'urgency'
  | 'status'
  | 'createdAt'
  | 'dueDate'
  | 'assigneeId'
  | 'hotelId'
> & {
  hotelName: string | null;
  assigneeName: string | null;
};

export type ListKanbanFilters = {
  urgency?: string | null;
  productCode?: string | null;
  /** true면 viewer.id == assigneeId 인 티켓만. */
  mineOnly?: boolean;
};

export type ListKanbanResult = Record<TicketStatus, TicketKanbanCard[]>;

/**
 * 칸반뷰 전용. 페이지네이션 없음. `completed`만 최근 30일.
 *
 * 성능: 4개 status 단위로 분리 쿼리하지 않고 1번 쿼리로 모두 가져온 뒤
 *       메모리에서 그룹핑. 대량 트래픽 시 status별 limit 적용 고려.
 */
export async function listAllTicketsForKanban(
  viewer?: ViewerLike,
  filters: ListKanbanFilters = {},
): Promise<ListKanbanResult> {
  const empty: ListKanbanResult = {
    received: [],
    in_progress: [],
    completed: [],
  };
  if (!db) return empty;

  const conditions: SQL[] = [eq(tickets.isActive, true)];

  if (filters.urgency) conditions.push(eq(tickets.urgency, filters.urgency));
  if (filters.productCode)
    conditions.push(eq(tickets.productCode, filters.productCode));
  if (filters.mineOnly && viewer) {
    conditions.push(eq(tickets.assigneeId, viewer.id));
  }

  // completed 컬럼은 최근 30일만 — completed가 아닌 status는 무조건 포함.
  // SQL: (status != 'completed') OR (status='completed' AND created_at >= now() - interval '30 days')
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  conditions.push(
    sql`(${tickets.status} <> 'completed' OR ${tickets.createdAt} >= ${thirtyDaysAgo.toISOString()})`,
  );

  const whereExpr =
    conditions.length === 1 ? conditions[0] : and(...conditions);

  try {
    const rows = await db
      .select({
        id: tickets.id,
        ticketNo: tickets.ticketNo,
        title: tickets.title,
        productCode: tickets.productCode,
        urgency: tickets.urgency,
        status: tickets.status,
        createdAt: tickets.createdAt,
        dueDate: tickets.dueDate,
        assigneeId: tickets.assigneeId,
        hotelId: tickets.hotelId,
        hotelName: hotels.name,
      })
      .from(tickets)
      .leftJoin(hotels, eq(tickets.hotelId, hotels.id))
      .where(whereExpr)
      .orderBy(desc(tickets.createdAt))
      // 안전 상한 — 컬럼당 평균 200건 이상이면 리스트뷰 사용 권장
      .limit(800);

    // assignee 이름 매핑
    const assigneeIds = Array.from(
      new Set(rows.map((r) => r.assigneeId).filter((v): v is string => !!v)),
    );
    const assigneeMap: Record<string, string> = {};
    if (assigneeIds.length > 0) {
      const userRows = await db
        .select({ id: users.id, name: users.name })
        .from(users)
        .where(inArray(users.id, assigneeIds));
      for (const u of userRows) assigneeMap[u.id] = u.name;
    }

    const out: ListKanbanResult = {
      received: [],
      in_progress: [],
      completed: [],
    };
    for (const r of rows) {
      const card: TicketKanbanCard = {
        ...r,
        assigneeName: r.assigneeId
          ? (assigneeMap[r.assigneeId] ?? null)
          : null,
      };
      out[r.status as TicketStatus].push(card);
    }
    return out;
  } catch (err) {
    console.error('[tickets.listAllTicketsForKanban] 실패:', err);
    return empty;
  }
}

// ─────────────────────────────────────────────────────────────────────
// ⑦ 피드백 (Phase 6)
// ─────────────────────────────────────────────────────────────────────

export type SubmitFeedbackInput = {
  ticketId: string;
  rating: TicketFeedbackRating;
  comment?: string | null;
  userId: string;
};

export type SubmitFeedbackResult = {
  ok: boolean;
  message?: string;
  feedbackId?: string;
};

/**
 * 호텔리어 피드백 제출.
 *
 * 동작:
 *   1) 본인이 reporter인 티켓인지 검증 (FORBIDDEN 방지)
 *   2) 티켓 상태가 completed인지 검증 (중간 상태에서 제출 차단)
 *   3) 기존 활성 피드백을 비활성 처리
 *   4) 새 피드백 insert
 *
 * 호출부에서는 권한(`requireAuth`) 통과 후 userId 전달. submitFeedback 내부는
 * "이 티켓의 reporter인지"까지만 추가 검증.
 */
export async function submitFeedback(
  input: SubmitFeedbackInput,
): Promise<SubmitFeedbackResult> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  try {
    const t = await getTicketRaw(input.ticketId);
    if (!t) return { ok: false, message: 'NOT_FOUND' };
    if (t.reporterId !== input.userId) {
      return { ok: false, message: 'FORBIDDEN' };
    }
    if (t.status !== 'completed') {
      return {
        ok: false,
        message: '완료된 티켓만 평가할 수 있습니다.',
      };
    }

    // 기존 활성 피드백을 비활성 처리
    await db
      .update(ticketFeedback)
      .set({ isActive: false })
      .where(
        and(
          eq(ticketFeedback.ticketId, input.ticketId),
          eq(ticketFeedback.isActive, true),
        ),
      );

    const row: NewTicketFeedback = {
      ticketId: input.ticketId,
      rating: input.rating,
      comment: input.comment?.trim() || null,
      submittedBy: input.userId,
    };
    const [created] = await db
      .insert(ticketFeedback)
      .values(row)
      .returning({ id: ticketFeedback.id });

    return { ok: true, feedbackId: created?.id };
  } catch (err) {
    console.error('[tickets.submitFeedback] 실패:', err);
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'INTERNAL_ERROR',
    };
  }
}

/** 최신 활성 피드백 1건. */
export async function getFeedback(
  ticketId: string,
): Promise<TicketFeedback | null> {
  if (!db) return null;
  try {
    const rows = await db
      .select()
      .from(ticketFeedback)
      .where(
        and(
          eq(ticketFeedback.ticketId, ticketId),
          eq(ticketFeedback.isActive, true),
        ),
      )
      .orderBy(desc(ticketFeedback.createdAt))
      .limit(1);
    return rows[0] ?? null;
  } catch (err) {
    console.error('[tickets.getFeedback] 실패:', err);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────
// 매니저 목록 (담당자 select용)
// ─────────────────────────────────────────────────────────────────────

export async function listAssignableManagers() {
  if (!db) return [];
  try {
    return await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
      })
      .from(users)
      .where(
        and(
          eq(users.isActive, true),
          inArray(users.role, ['manager', 'admin']),
        ),
      )
      .orderBy(asc(users.role), asc(users.name));
  } catch (err) {
    console.error('[tickets.listAssignableManagers] 실패:', err);
    return [];
  }
}
