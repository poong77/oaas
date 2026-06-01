/**
 * 검색 실사용 로그 서비스 — Layer B (Server 전용).
 *
 * 기록: logSearch(검색 시) → recordClick(결과 클릭) → recordTicketIntent(접수 전환).
 * 모두 best-effort, 실패해도 메인 흐름에 영향 없음.
 *
 * 집계: getUsageStats / topZeroQueries / topQueries (어드민 대시보드).
 */

import 'server-only';
import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm';

import { db } from '@/db';
import {
  searchLogs,
  type SearchResultCounts,
  type NewSearchLog,
} from '@/db/schema';
import { normalizeTerm } from '@/lib/text/normalize';

/** 검색 1회 기록. 성공 시 logId 반환(클릭/전환 추적용), 실패 시 null. */
export async function logSearch(input: {
  query: string;
  counts: SearchResultCounts;
  productCode?: string | null;
  userId?: string | null;
  role?: string | null;
  sessionKey?: string | null;
}): Promise<string | null> {
  if (!db) return null;
  const query = input.query.trim();
  if (!query) return null;
  try {
    const total =
      input.counts.help +
      input.counts.faq +
      input.counts.notice +
      input.counts.incident;
    const values: NewSearchLog = {
      query,
      normalizedQuery: normalizeTerm(query),
      resultCounts: input.counts,
      totalResults: total,
      zeroResult: total === 0,
      productCode: input.productCode ?? null,
      userId: input.userId ?? null,
      role: input.role ?? null,
      sessionKey: input.sessionKey ?? null,
    };
    const [row] = await db
      .insert(searchLogs)
      .values(values)
      .returning({ id: searchLogs.id });
    return row?.id ?? null;
  } catch (err) {
    console.warn(
      '[search-logs.logSearch] 기록 실패:',
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

export async function recordClick(input: {
  logId: string;
  kind: string;
  ref: string;
  position: number;
}): Promise<void> {
  if (!db) return;
  try {
    await db
      .update(searchLogs)
      .set({
        clicked: true,
        clickedKind: input.kind,
        clickedRef: input.ref,
        clickedPosition: input.position,
      })
      .where(eq(searchLogs.id, input.logId));
  } catch (err) {
    console.warn(
      '[search-logs.recordClick] 실패:',
      err instanceof Error ? err.message : err,
    );
  }
}

export async function recordTicketIntent(logId: string): Promise<void> {
  if (!db) return;
  try {
    await db
      .update(searchLogs)
      .set({ ledToTicket: true })
      .where(eq(searchLogs.id, logId));
  } catch (err) {
    console.warn(
      '[search-logs.recordTicketIntent] 실패:',
      err instanceof Error ? err.message : err,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────
// 집계 (대시보드)
// ─────────────────────────────────────────────────────────────────────

export type UsageStats = {
  totalSearches: number;
  zeroResults: number;
  zeroRate: number;
  clicks: number;
  ctr: number;
  avgClickPosition: number | null;
  ticketIntents: number;
  ticketRate: number;
  /** 검색→접수로 안 넘어간 비율 (자가해결 추정). */
  deflectionRate: number;
};

function sinceDate(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export async function getUsageStats(days = 30): Promise<UsageStats> {
  const empty: UsageStats = {
    totalSearches: 0,
    zeroResults: 0,
    zeroRate: 0,
    clicks: 0,
    ctr: 0,
    avgClickPosition: null,
    ticketIntents: 0,
    ticketRate: 0,
    deflectionRate: 0,
  };
  if (!db) return empty;
  try {
    const since = sinceDate(days);
    const rows = await db
      .select({
        total: sql<number>`count(*)::int`,
        zero: sql<number>`count(*) filter (where ${searchLogs.zeroResult})::int`,
        clicks: sql<number>`count(*) filter (where ${searchLogs.clicked})::int`,
        avgPos: sql<number | null>`avg(${searchLogs.clickedPosition})`,
        tickets: sql<number>`count(*) filter (where ${searchLogs.ledToTicket})::int`,
      })
      .from(searchLogs)
      .where(gte(searchLogs.createdAt, since));
    const r = rows[0];
    const total = Number(r?.total ?? 0);
    if (total === 0) return empty;
    const zero = Number(r?.zero ?? 0);
    const clicks = Number(r?.clicks ?? 0);
    const tickets = Number(r?.tickets ?? 0);
    return {
      totalSearches: total,
      zeroResults: zero,
      zeroRate: zero / total,
      clicks,
      ctr: clicks / total,
      avgClickPosition: r?.avgPos != null ? Number(r.avgPos) : null,
      ticketIntents: tickets,
      ticketRate: tickets / total,
      deflectionRate: 1 - tickets / total,
    };
  } catch (err) {
    console.error('[search-logs.getUsageStats] 실패:', err);
    return empty;
  }
}

export type QueryAgg = {
  query: string;
  count: number;
  avgResults: number;
};

/** 0건 검색 top — 콘텐츠/동의어 갭 신호. */
export async function topZeroQueries(
  days = 30,
  limit = 30,
): Promise<QueryAgg[]> {
  if (!db) return [];
  try {
    const since = sinceDate(days);
    const rows = await db
      .select({
        query: searchLogs.normalizedQuery,
        count: sql<number>`count(*)::int`,
        avgResults: sql<number>`avg(${searchLogs.totalResults})`,
      })
      .from(searchLogs)
      .where(
        and(gte(searchLogs.createdAt, since), eq(searchLogs.zeroResult, true)),
      )
      .groupBy(searchLogs.normalizedQuery)
      .orderBy(desc(sql`count(*)`))
      .limit(limit);
    return rows.map((r) => ({
      query: r.query,
      count: Number(r.count),
      avgResults: Number(r.avgResults ?? 0),
    }));
  } catch (err) {
    console.error('[search-logs.topZeroQueries] 실패:', err);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────
// 퍼널 (노출 → 클릭 → 접수) — #6
// ─────────────────────────────────────────────────────────────────────

export type FunnelStats = {
  searches: number;
  clicks: number;
  /** 클릭 위치 분포 (1~4 / 5~8 / 9+위). */
  clickTop4: number;
  clickMid: number;
  clickDeep: number;
  /** 클릭 후 접수로 진행 (자가해결 실패의 일부). */
  clickThenTicket: number;
  /** 클릭 없이 바로 접수 (검색 실패 신호). */
  ticketNoClick: number;
  /** 검색 후 접수 안 함 = 자가해결 추정. */
  deflectionRate: number;
};

export async function getFunnelStats(days = 30): Promise<FunnelStats> {
  const empty: FunnelStats = {
    searches: 0,
    clicks: 0,
    clickTop4: 0,
    clickMid: 0,
    clickDeep: 0,
    clickThenTicket: 0,
    ticketNoClick: 0,
    deflectionRate: 0,
  };
  if (!db) return empty;
  try {
    const since = sinceDate(days);
    const rows = await db
      .select({
        searches: sql<number>`count(*)::int`,
        clicks: sql<number>`count(*) filter (where ${searchLogs.clicked})::int`,
        clickTop4: sql<number>`count(*) filter (where ${searchLogs.clickedPosition} between 1 and 4)::int`,
        clickMid: sql<number>`count(*) filter (where ${searchLogs.clickedPosition} between 5 and 8)::int`,
        clickDeep: sql<number>`count(*) filter (where ${searchLogs.clickedPosition} >= 9)::int`,
        clickThenTicket: sql<number>`count(*) filter (where ${searchLogs.clicked} and ${searchLogs.ledToTicket})::int`,
        ticketNoClick: sql<number>`count(*) filter (where ${searchLogs.ledToTicket} and not ${searchLogs.clicked})::int`,
        tickets: sql<number>`count(*) filter (where ${searchLogs.ledToTicket})::int`,
      })
      .from(searchLogs)
      .where(gte(searchLogs.createdAt, since));
    const r = rows[0];
    const searches = Number(r?.searches ?? 0);
    if (searches === 0) return empty;
    const tickets = Number(r?.tickets ?? 0);
    return {
      searches,
      clicks: Number(r?.clicks ?? 0),
      clickTop4: Number(r?.clickTop4 ?? 0),
      clickMid: Number(r?.clickMid ?? 0),
      clickDeep: Number(r?.clickDeep ?? 0),
      clickThenTicket: Number(r?.clickThenTicket ?? 0),
      ticketNoClick: Number(r?.ticketNoClick ?? 0),
      deflectionRate: 1 - tickets / searches,
    };
  } catch (err) {
    console.error('[search-logs.getFunnelStats] 실패:', err);
    return empty;
  }
}

export type QueryUsage = {
  searches: number;
  ctr: number;
  avgClickPosition: number | null;
  ticketRate: number;
};

/**
 * 골든셋 질의를 실사용 로그와 조인 — normalizedQuery별 실제 행동 지표.
 * 오프라인 순위 옆에 "실제로 눌렀나/접수했나"를 붙이는 용도.
 */
export async function getUsageByQueries(
  normalizedQueries: string[],
  days = 90,
): Promise<Record<string, QueryUsage>> {
  if (!db || normalizedQueries.length === 0) return {};
  try {
    const since = sinceDate(days);
    const rows = await db
      .select({
        nq: searchLogs.normalizedQuery,
        searches: sql<number>`count(*)::int`,
        clicks: sql<number>`count(*) filter (where ${searchLogs.clicked})::int`,
        avgPos: sql<number | null>`avg(${searchLogs.clickedPosition})`,
        tickets: sql<number>`count(*) filter (where ${searchLogs.ledToTicket})::int`,
      })
      .from(searchLogs)
      .where(
        and(
          gte(searchLogs.createdAt, since),
          inArray(searchLogs.normalizedQuery, normalizedQueries),
        ),
      )
      .groupBy(searchLogs.normalizedQuery);
    const out: Record<string, QueryUsage> = {};
    for (const r of rows) {
      const s = Number(r.searches);
      out[r.nq] = {
        searches: s,
        ctr: s > 0 ? Number(r.clicks) / s : 0,
        avgClickPosition: r.avgPos != null ? Number(r.avgPos) : null,
        ticketRate: s > 0 ? Number(r.tickets) / s : 0,
      };
    }
    return out;
  } catch (err) {
    console.error('[search-logs.getUsageByQueries] 실패:', err);
    return {};
  }
}

/** 인기 검색어 top. */
export async function topQueries(days = 30, limit = 30): Promise<QueryAgg[]> {
  if (!db) return [];
  try {
    const since = sinceDate(days);
    const rows = await db
      .select({
        query: searchLogs.normalizedQuery,
        count: sql<number>`count(*)::int`,
        avgResults: sql<number>`avg(${searchLogs.totalResults})`,
      })
      .from(searchLogs)
      .where(gte(searchLogs.createdAt, since))
      .groupBy(searchLogs.normalizedQuery)
      .orderBy(desc(sql`count(*)`))
      .limit(limit);
    return rows.map((r) => ({
      query: r.query,
      count: Number(r.count),
      avgResults: Number(r.avgResults ?? 0),
    }));
  } catch (err) {
    console.error('[search-logs.topQueries] 실패:', err);
    return [];
  }
}
