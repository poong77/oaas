/**
 * 운영 인사이트 대시보드 (DI-01) 집계 서비스 — Server 전용.
 *
 * 모든 함수 graceful(`if(!db)`) + try/catch. 기간 코호트(created_at) 일관.
 * Dev개입 신호: ticket_messages.metadata.eventKey='ticket.escalated_dev'
 * 접수(착수): status ∈ (in_progress, completed)
 * 완료 시각: status_change metadata.to='completed' 의 max(created_at)
 * 첫 응답: 운영팀(role manager/admin) public 메시지 min(created_at)
 */

import 'server-only';
import { and, eq, gte, inArray, lt, ne, sql } from 'drizzle-orm';

import { db } from '@/db';
import {
  hotels,
  ticketMessages,
  tickets,
  users,
  searchLogs,
} from '@/db/schema';
import { loadCategoryLabelMaps } from './tickets';
import { loadSynonymIndex } from './master-synonyms';
import { getAllTicketChannelsMap } from './master-ticket-channels';
import { businessDaysBetween, loadHolidaySet } from './business-days';
import { kstYmd } from '@/lib/date/kst';

// ─────────────────────────────────────────────────────────────────────
// 공통 — 기간 / 채널 라벨
// ─────────────────────────────────────────────────────────────────────

export {
  DASHBOARD_PERIODS,
  PERIOD_LABEL,
  type DashboardPeriod,
} from './insights-shared';
import type { DashboardPeriod } from './insights-shared';

/** 복수 채널(2개 이상) 버킷 코드·라벨. 채널 라벨은 ticket_channels 마스터에서 로드. */
const MULTI_CHANNEL_CODE = '__multi__';
const MULTI_CHANNEL_LABEL = '여럿';

/**
 * 기간 → [start, end) UTC 경계 (KST 자정 정렬, 오늘 제외).
 * 어제=1일 / 7d=7일 / 30d=30일, 모두 오늘 00:00 KST를 end로.
 */
function kstPeriodRange(period: DashboardPeriod): { start: Date; end: Date } {
  const todayStart = new Date(`${kstYmd(new Date())}T00:00:00+09:00`);
  const days = period === 'yesterday' ? 1 : period === '7d' ? 7 : 30;
  const start = new Date(todayStart.getTime() - days * 24 * 60 * 60 * 1000);
  return { start, end: todayStart };
}

/** [start,end) 사이의 KST 날짜 문자열 목록 (차트 x축). */
function kstDayList(start: Date, end: Date): string[] {
  const out: string[] = [];
  let cur = new Date(start);
  let guard = 0;
  while (cur < end && guard++ < 400) {
    out.push(kstYmd(cur));
    cur = new Date(cur.getTime() + 24 * 60 * 60 * 1000);
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────
// 타입
// ─────────────────────────────────────────────────────────────────────

export type ActionCards = { p1Open: number; longDelayed: number };

export type CompletionMetrics = {
  completed: number;
  oneCall: number;
  oneCallRate: number;
  selfTeam: number;
  selfTeamRate: number;
  devInvolved: number;
  devRate: number;
};

export type FunnelStats = {
  search: number;
  inquiry: number;
  accepted: number;
  devEscalated: number;
  completed: number;
};

export type KeywordAgg = { term: string; count: number; zeroRate: number };
export type HotelAgg = { hotelName: string; count: number };
export type ChannelDaily = { days: string[]; series: { name: string; data: number[] }[] };
export type TypeAgg = { code: string; label: string; completed: number; ongoing: number };
export type ProductAgg = { label: string; count: number };
export type StatusDist = {
  received: number;
  in_progress: number;
  completed: number;
};
export type TimeMetrics = {
  avgFirstResponseHours: number | null;
  avgResolutionBizDays: number | null;
};
export type DevBacklogRow = {
  ticketNo: string;
  productLabel: string;
  issueTypeLabel: string;
  elapsedBizDays: number;
};
export type AssigneeRow = {
  id: string;
  name: string;
  completed: number;
  ongoing: number;
  avgResolutionBizDays: number | null;
};

export type DashboardData = {
  period: DashboardPeriod;
  productCode: string | null;
  actionCards: ActionCards;
  completion: CompletionMetrics;
  funnel: FunnelStats;
  keywords: KeywordAgg[];
  hotels: HotelAgg[];
  channelDaily: ChannelDaily;
  byType: TypeAgg[];
  byProduct: ProductAgg[];
  statusDist: StatusDist;
  timeMetrics: TimeMetrics;
  devBacklog: DevBacklogRow[];
  assignees: AssigneeRow[];
};

type RangeTicket = {
  id: string;
  hotelId: string | null;
  productCode: string;
  issueType: string;
  urgency: string;
  status: 'received' | 'in_progress' | 'completed';
  assigneeId: string | null;
  channel: string;
  channels: string[];
  oneCallResolved: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const ACCEPTED_STATUSES = ['in_progress', 'completed'] as const;

// ─────────────────────────────────────────────────────────────────────
// 단일 진입
// ─────────────────────────────────────────────────────────────────────

export async function getDashboardData(input: {
  period: DashboardPeriod;
  productCode?: string | null;
  /** 페이지에서 이미 로드한 카테고리 라벨 — 중복 조회 방지(없으면 내부 로드). */
  labels?: Awaited<ReturnType<typeof loadCategoryLabelMaps>>;
}): Promise<DashboardData> {
  const period = input.period;
  const productCode = input.productCode?.trim() || null;
  const { start, end } = kstPeriodRange(period);

  const empty: DashboardData = {
    period,
    productCode,
    actionCards: { p1Open: 0, longDelayed: 0 },
    completion: {
      completed: 0,
      oneCall: 0,
      oneCallRate: 0,
      selfTeam: 0,
      selfTeamRate: 0,
      devInvolved: 0,
      devRate: 0,
    },
    funnel: { search: 0, inquiry: 0, accepted: 0, devEscalated: 0, completed: 0 },
    keywords: [],
    hotels: [],
    channelDaily: { days: kstDayList(start, end), series: [] },
    byType: [],
    byProduct: [],
    statusDist: { received: 0, in_progress: 0, completed: 0 },
    timeMetrics: { avgFirstResponseHours: null, avgResolutionBizDays: null },
    devBacklog: [],
    assignees: [],
  };
  if (!db) return empty;

  try {
    const [labels, holidays, channelMap, rangeTickets, keywords, searchTotal] =
      await Promise.all([
        input.labels ? Promise.resolve(input.labels) : loadCategoryLabelMaps(),
        loadHolidaySet(),
        getAllTicketChannelsMap(),
        loadRangeTickets(start, end, productCode),
        getSearchKeywords(start, end, productCode, 30),
        getSearchTotal(start, end, productCode),
      ]);

    const ids = rangeTickets.map((t) => t.id);

    const [devSet, completedAtMap, firstRespMap, hotelNameMap, assigneeNameMap] =
      await Promise.all([
        loadDevInvolvedSet(ids),
        loadCompletedAtMap(ids),
        loadFirstResponseMap(ids),
        loadHotelNames(rangeTickets),
        loadAssigneeNames(rangeTickets),
      ]);

    const [actionCards, devBacklog] = await Promise.all([
      getActionCards(holidays),
      getDevBacklog(labels, holidays, 8),
    ]);

    return {
      period,
      productCode,
      actionCards,
      completion: computeCompletion(rangeTickets, devSet),
      funnel: computeFunnel(rangeTickets, devSet, searchTotal),
      keywords,
      hotels: computeHotelTop15(rangeTickets, hotelNameMap),
      channelDaily: computeChannelDaily(rangeTickets, start, end, channelMap),
      byType: computeByType(rangeTickets, labels.issueType),
      byProduct: computeByProduct(rangeTickets, labels.product),
      statusDist: computeStatusDist(rangeTickets),
      timeMetrics: computeTimeMetrics(
        rangeTickets,
        completedAtMap,
        firstRespMap,
        holidays,
      ),
      devBacklog,
      assignees: computeAssignees(
        rangeTickets,
        assigneeNameMap,
        completedAtMap,
        holidays,
      ),
    };
  } catch (err) {
    console.error('[insights.getDashboardData] 실패:', err);
    return empty;
  }
}

// ─────────────────────────────────────────────────────────────────────
// 로더 (DB 쿼리)
// ─────────────────────────────────────────────────────────────────────

async function loadRangeTickets(
  start: Date,
  end: Date,
  productCode: string | null,
): Promise<RangeTicket[]> {
  if (!db) return [];
  const conds = [
    eq(tickets.isActive, true),
    gte(tickets.createdAt, start),
    lt(tickets.createdAt, end),
  ];
  if (productCode) conds.push(eq(tickets.productCode, productCode));
  const rows = await db
    .select({
      id: tickets.id,
      hotelId: tickets.hotelId,
      productCode: tickets.productCode,
      issueType: tickets.issueType,
      urgency: tickets.urgency,
      status: tickets.status,
      assigneeId: tickets.assigneeId,
      channel: tickets.channel,
      channels: tickets.channels,
      oneCallResolved: tickets.oneCallResolved,
      createdAt: tickets.createdAt,
      updatedAt: tickets.updatedAt,
    })
    .from(tickets)
    .where(and(...conds))
    .limit(20000); // 안전 상한 — 초과 누적 시 DB 집계 이관 검토(설계 §6 후속).
  return rows as RangeTicket[];
}

/** 에스컬레이션된 티켓 id 집합. */
async function loadDevInvolvedSet(ids: string[]): Promise<Set<string>> {
  if (!db || ids.length === 0) return new Set();
  const rows = await db
    .selectDistinct({ ticketId: ticketMessages.ticketId })
    .from(ticketMessages)
    .where(
      and(
        inArray(ticketMessages.ticketId, ids),
        sql`(${ticketMessages.metadata} ->> 'eventKey') = 'ticket.escalated_dev'`,
      ),
    );
  return new Set(rows.map((r) => r.ticketId));
}

/** 티켓별 완료 전환 시각(status_change to=completed의 max). */
async function loadCompletedAtMap(ids: string[]): Promise<Map<string, Date>> {
  const map = new Map<string, Date>();
  if (!db || ids.length === 0) return map;
  const rows = await db
    .select({
      ticketId: ticketMessages.ticketId,
      epoch: sql<number>`extract(epoch from max(${ticketMessages.createdAt}))`,
    })
    .from(ticketMessages)
    .where(
      and(
        inArray(ticketMessages.ticketId, ids),
        eq(ticketMessages.kind, 'status_change'),
        sql`(${ticketMessages.metadata} ->> 'to') = 'completed'`,
      ),
    )
    .groupBy(ticketMessages.ticketId);
  for (const r of rows)
    if (r.epoch != null) map.set(r.ticketId, new Date(Number(r.epoch) * 1000));
  return map;
}

/** 티켓별 운영팀 첫 public 응답 시각. */
async function loadFirstResponseMap(ids: string[]): Promise<Map<string, Date>> {
  const map = new Map<string, Date>();
  if (!db || ids.length === 0) return map;
  const rows = await db
    .select({
      ticketId: ticketMessages.ticketId,
      epoch: sql<number>`extract(epoch from min(${ticketMessages.createdAt}))`,
    })
    .from(ticketMessages)
    .innerJoin(users, eq(ticketMessages.authorId, users.id))
    .where(
      and(
        inArray(ticketMessages.ticketId, ids),
        eq(ticketMessages.kind, 'public'),
        inArray(users.role, ['manager', 'admin']),
      ),
    )
    .groupBy(ticketMessages.ticketId);
  for (const r of rows)
    if (r.epoch != null) map.set(r.ticketId, new Date(Number(r.epoch) * 1000));
  return map;
}

async function loadHotelNames(
  rangeTickets: RangeTicket[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!db) return map;
  const hotelIds = [
    ...new Set(rangeTickets.map((t) => t.hotelId).filter((v): v is string => !!v)),
  ];
  if (hotelIds.length === 0) return map;
  const rows = await db
    .select({ id: hotels.id, name: hotels.name })
    .from(hotels)
    .where(inArray(hotels.id, hotelIds));
  for (const r of rows) map.set(r.id, r.name);
  return map;
}

async function loadAssigneeNames(
  rangeTickets: RangeTicket[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!db) return map;
  const aids = [
    ...new Set(
      rangeTickets.map((t) => t.assigneeId).filter((v): v is string => !!v),
    ),
  ];
  if (aids.length === 0) return map;
  const rows = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(inArray(users.id, aids));
  for (const r of rows) map.set(r.id, r.name);
  return map;
}

/** 기간 내 검색 로그 총 건수 (퍼널 1단계). */
async function getSearchTotal(
  start: Date,
  end: Date,
  productCode: string | null,
): Promise<number> {
  if (!db) return 0;
  try {
    const conds = [gte(searchLogs.createdAt, start), lt(searchLogs.createdAt, end)];
    if (productCode) conds.push(eq(searchLogs.productCode, productCode));
    const rows = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(searchLogs)
      .where(and(...conds));
    return Number(rows[0]?.n ?? 0);
  } catch (err) {
    console.error('[insights.getSearchTotal] 실패:', err);
    return 0;
  }
}

/** 검색어 — 동의어 대표어(canonical) 기준 빈도 집계. */
export async function getSearchKeywords(
  start: Date,
  end: Date,
  productCode: string | null,
  limit = 30,
): Promise<KeywordAgg[]> {
  if (!db) return [];
  try {
    const conds = [gte(searchLogs.createdAt, start), lt(searchLogs.createdAt, end)];
    if (productCode) conds.push(eq(searchLogs.productCode, productCode));
    const [rows, index] = await Promise.all([
      db
        .select({
          nq: searchLogs.normalizedQuery,
          count: sql<number>`count(*)::int`,
          zero: sql<number>`count(*) filter (where ${searchLogs.zeroResult})::int`,
        })
        .from(searchLogs)
        .where(and(...conds))
        .groupBy(searchLogs.normalizedQuery),
      loadSynonymIndex(),
    ]);

    // 대표어로 접어서 합산.
    const agg = new Map<string, { count: number; zero: number }>();
    for (const r of rows) {
      const nq = r.nq;
      const gids = index.termToGroupIds.get(nq);
      let key = nq;
      if (gids && gids.size > 0) {
        const gid = [...gids][0];
        key = index.groupIdToTerms.get(gid)?.[0] ?? nq; // canonical = [0]
      }
      const prev = agg.get(key) ?? { count: 0, zero: 0 };
      prev.count += Number(r.count);
      prev.zero += Number(r.zero);
      agg.set(key, prev);
    }
    return [...agg.entries()]
      .map(([term, v]) => ({
        term,
        count: v.count,
        zeroRate: v.count > 0 ? v.zero / v.count : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  } catch (err) {
    console.error('[insights.getSearchKeywords] 실패:', err);
    return [];
  }
}

/** 액션카드 — 전역 스냅샷(현재 미완료 기준). */
async function getActionCards(holidays: Set<string>): Promise<ActionCards> {
  if (!db) return { p1Open: 0, longDelayed: 0 };
  try {
    const [p1Rows, openRows] = await Promise.all([
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(tickets)
        .where(
          and(
            eq(tickets.isActive, true),
            eq(tickets.urgency, 'p1'),
            ne(tickets.status, 'completed'),
          ),
        ),
      db
        .select({ createdAt: tickets.createdAt })
        .from(tickets)
        .where(
          and(
            eq(tickets.isActive, true),
            // 지연건 = 처리중(in_progress) 단계 ∩ 접수 후 영업일 3일 초과
            eq(tickets.status, 'in_progress'),
          ),
        ),
    ]);
    const now = new Date();
    const longDelayed = openRows.filter(
      (r) => businessDaysBetween(r.createdAt, now, holidays) > 3,
    ).length;
    return { p1Open: Number(p1Rows[0]?.n ?? 0), longDelayed };
  } catch (err) {
    console.error('[insights.getActionCards] 실패:', err);
    return { p1Open: 0, longDelayed: 0 };
  }
}

/** Dev 에스컬레이션 백로그 — 미완료 에스컬 티켓, 경과 영업일 desc. */
async function getDevBacklog(
  labels: Awaited<ReturnType<typeof loadCategoryLabelMaps>>,
  holidays: Set<string>,
  limit = 8,
): Promise<DevBacklogRow[]> {
  if (!db) return [];
  try {
    const escalatedIdRows = await db
      .selectDistinct({ ticketId: ticketMessages.ticketId })
      .from(ticketMessages)
      .where(
        sql`(${ticketMessages.metadata} ->> 'eventKey') = 'ticket.escalated_dev'`,
      );
    const escalatedIds = escalatedIdRows.map((r) => r.ticketId);
    if (escalatedIds.length === 0) return [];
    const rows = await db
      .select({
        ticketNo: tickets.ticketNo,
        productCode: tickets.productCode,
        issueType: tickets.issueType,
        createdAt: tickets.createdAt,
      })
      .from(tickets)
      .where(
        and(
          eq(tickets.isActive, true),
          ne(tickets.status, 'completed'),
          inArray(tickets.id, escalatedIds),
        ),
      );
    const now = new Date();
    return rows
      .map((r) => ({
        ticketNo: r.ticketNo,
        productLabel: labels.product[r.productCode] ?? r.productCode,
        issueTypeLabel: labels.issueType[r.issueType] ?? r.issueType,
        elapsedBizDays: businessDaysBetween(r.createdAt, now, holidays),
      }))
      .sort((a, b) => b.elapsedBizDays - a.elapsedBizDays)
      .slice(0, limit);
  } catch (err) {
    console.error('[insights.getDevBacklog] 실패:', err);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────
// JS 집계 (rangeTickets 기반)
// ─────────────────────────────────────────────────────────────────────

function computeCompletion(
  rangeTickets: RangeTicket[],
  devSet: Set<string>,
): CompletionMetrics {
  const completedTickets = rangeTickets.filter((t) => t.status === 'completed');
  const completed = completedTickets.length;
  const oneCall = completedTickets.filter((t) => t.oneCallResolved).length;
  const devInvolved = completedTickets.filter((t) => devSet.has(t.id)).length;
  const selfTeam = completed - devInvolved;
  return {
    completed,
    oneCall,
    oneCallRate: completed > 0 ? oneCall / completed : 0,
    selfTeam,
    selfTeamRate: completed > 0 ? selfTeam / completed : 0,
    devInvolved,
    devRate: completed > 0 ? devInvolved / completed : 0,
  };
}

function computeFunnel(
  rangeTickets: RangeTicket[],
  devSet: Set<string>,
  searchTotal: number,
): FunnelStats {
  const inquiry = rangeTickets.length;
  const accepted = rangeTickets.filter((t) =>
    (ACCEPTED_STATUSES as readonly string[]).includes(t.status),
  ).length;
  const devEscalated = rangeTickets.filter((t) => devSet.has(t.id)).length;
  const completed = rangeTickets.filter((t) => t.status === 'completed').length;
  return { search: searchTotal, inquiry, accepted, devEscalated, completed };
}

function computeHotelTop15(
  rangeTickets: RangeTicket[],
  hotelNameMap: Map<string, string>,
): HotelAgg[] {
  const counts = new Map<string, number>();
  for (const t of rangeTickets) {
    if (!t.hotelId) continue;
    counts.set(t.hotelId, (counts.get(t.hotelId) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([id, count]) => ({
      hotelName: hotelNameMap.get(id) ?? '(알 수 없음)',
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);
}

/** 유입 채널 버킷 코드 — 2개 이상이면 '여럿'(MULTI). 라벨은 표시 시점에 매핑. */
function bucketChannelCode(t: RangeTicket): string {
  const arr =
    Array.isArray(t.channels) && t.channels.length > 0
      ? t.channels
      : t.channel
        ? [t.channel]
        : [];
  if (arr.length >= 2) return MULTI_CHANNEL_CODE;
  return arr[0] ?? t.channel ?? 'web';
}

function computeChannelDaily(
  rangeTickets: RangeTicket[],
  start: Date,
  end: Date,
  channelMap: Awaited<ReturnType<typeof getAllTicketChannelsMap>>,
): ChannelDaily {
  const days = kstDayList(start, end);
  const dayIndex = new Map(days.map((d, i) => [d, i]));
  // 채널 코드별 일자 배열로 집계.
  const byCode = new Map<string, number[]>();
  const ensure = (code: string) => {
    if (!byCode.has(code)) byCode.set(code, new Array(days.length).fill(0));
    return byCode.get(code)!;
  };
  for (const t of rangeTickets) {
    const di = dayIndex.get(kstYmd(t.createdAt));
    if (di === undefined) continue;
    ensure(bucketChannelCode(t))[di] += 1;
  }
  // 표시 순서: 마스터 sortOrder → '여럿' 마지막. 라벨은 ticket_channels 마스터에서.
  const codes = [...byCode.keys()].sort((a, b) => {
    if (a === MULTI_CHANNEL_CODE) return 1;
    if (b === MULTI_CHANNEL_CODE) return -1;
    return (
      (channelMap.get(a)?.sortOrder ?? 999) -
      (channelMap.get(b)?.sortOrder ?? 999)
    );
  });
  return {
    days,
    series: codes.map((code) => ({
      name:
        code === MULTI_CHANNEL_CODE
          ? MULTI_CHANNEL_LABEL
          : (channelMap.get(code)?.label ?? code),
      data: byCode.get(code)!,
    })),
  };
}

function computeByType(
  rangeTickets: RangeTicket[],
  issueLabels: Record<string, string>,
): TypeAgg[] {
  const map = new Map<string, { completed: number; ongoing: number }>();
  for (const t of rangeTickets) {
    const prev = map.get(t.issueType) ?? { completed: 0, ongoing: 0 };
    if (t.status === 'completed') prev.completed += 1;
    else prev.ongoing += 1;
    map.set(t.issueType, prev);
  }
  return [...map.entries()]
    .map(([code, v]) => ({
      code,
      label: issueLabels[code] ?? code,
      completed: v.completed,
      ongoing: v.ongoing,
    }))
    .sort((a, b) => b.completed + b.ongoing - (a.completed + a.ongoing));
}

function computeByProduct(
  rangeTickets: RangeTicket[],
  productLabels: Record<string, string>,
): ProductAgg[] {
  const map = new Map<string, number>();
  for (const t of rangeTickets) {
    map.set(t.productCode, (map.get(t.productCode) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([code, count]) => ({ label: productLabels[code] ?? code, count }))
    .sort((a, b) => b.count - a.count);
}

function computeStatusDist(rangeTickets: RangeTicket[]): StatusDist {
  const dist: StatusDist = {
    received: 0,
    in_progress: 0,
    completed: 0,
  };
  for (const t of rangeTickets) dist[t.status] += 1;
  return dist;
}

function computeTimeMetrics(
  rangeTickets: RangeTicket[],
  completedAtMap: Map<string, Date>,
  firstRespMap: Map<string, Date>,
  holidays: Set<string>,
): TimeMetrics {
  // 첫 응답: 첫 응답이 있는 모든 기간 티켓 대상.
  const respHours: number[] = [];
  for (const t of rangeTickets) {
    const at = firstRespMap.get(t.id);
    if (at) {
      const h = (at.getTime() - t.createdAt.getTime()) / 3_600_000;
      if (h >= 0) respHours.push(h);
    }
  }
  // 해결 소요: 완료 티켓 대상 (영업일).
  const resBiz: number[] = [];
  for (const t of rangeTickets) {
    if (t.status !== 'completed') continue;
    // 완료 시각: status_change(to=completed) 없으면 updated_at 폴백 (설계 §4).
    const at = completedAtMap.get(t.id) ?? t.updatedAt;
    resBiz.push(businessDaysBetween(t.createdAt, at, holidays));
  }
  const avg = (arr: number[]) =>
    arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : null;
  return {
    avgFirstResponseHours: avg(respHours),
    avgResolutionBizDays: avg(resBiz),
  };
}

function computeAssignees(
  rangeTickets: RangeTicket[],
  nameMap: Map<string, string>,
  completedAtMap: Map<string, Date>,
  holidays: Set<string>,
): AssigneeRow[] {
  type Acc = {
    completed: number;
    ongoing: number;
    resBiz: number[];
  };
  const map = new Map<string, Acc>();
  for (const t of rangeTickets) {
    if (!t.assigneeId) continue;
    const acc =
      map.get(t.assigneeId) ?? { completed: 0, ongoing: 0, resBiz: [] };
    if (t.status === 'completed') {
      acc.completed += 1;
      // 완료 시각: status_change 없으면 updated_at 폴백 (설계 §4).
      const at = completedAtMap.get(t.id) ?? t.updatedAt;
      acc.resBiz.push(businessDaysBetween(t.createdAt, at, holidays));
    } else {
      acc.ongoing += 1;
    }
    map.set(t.assigneeId, acc);
  }
  return [...map.entries()]
    .map(([id, a]) => ({
      id,
      name: nameMap.get(id) ?? '(미상)',
      completed: a.completed,
      ongoing: a.ongoing,
      avgResolutionBizDays:
        a.resBiz.length > 0
          ? a.resBiz.reduce((s, v) => s + v, 0) / a.resBiz.length
          : null,
    }))
    .sort((a, b) => b.completed - a.completed);
}
