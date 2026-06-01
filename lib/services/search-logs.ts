/**
 * 검색 실사용 로그 서비스 — Layer B (Server 전용).
 *
 * 기록: logSearch(검색 시) → recordClick(결과 클릭) → recordTicketIntent(접수 전환).
 * 모두 best-effort, 실패해도 메인 흐름에 영향 없음.
 *
 * 집계: getUsageStats / topZeroQueries / topQueries (어드민 대시보드).
 */

import 'server-only';
import { and, desc, eq, gte, inArray, lt, sql } from 'drizzle-orm';

import { db } from '@/db';
import {
  articles,
  faqs,
  notices,
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

// ─────────────────────────────────────────────────────────────────────
// 검색 이력 (어드민 > 인사이트 > 검색로그) — 1행 = 1회 검색 visit
// ─────────────────────────────────────────────────────────────────────

/**
 * 기간 필터.
 * - `today`   : 오늘 00:00 KST ~ 현재 시각 (실시간, 기본값)
 * - 나머지     : "어제"를 끝으로 함 (오늘 제외)
 */
export type SearchLogPeriod = 'today' | 'yesterday' | '7d' | '30d';

/** 클릭해서 도착한 페이지의 "도움됐어요/아니예요" 반응표 집계. */
export type HelpfulTally = { yes: number; no: number };

export type SearchLogRow = {
  id: string;
  query: string;
  createdAt: Date;
  /** 같은 세션 내 다음 활동까지의 간격(초). 세션키 없거나 단발이면 null. */
  dwellSeconds: number | null;
  /** 클릭해 도착한 아티클/FAQ 하단 반응표 집계. 반응표 없는 대상/미클릭이면 null. */
  helpful: HelpfulTally | null;
  /** 유출(이동) 페이지의 정식 URL — 클릭/접수 결과. 없으면 null(이탈/삭제). */
  outflowUrl: string | null;
  /** 유출 페이지 표시 타이틀(아티클 title/FAQ question/공지 title 등). 이탈이면 null. */
  outflowLabel: string | null;
};

export type SearchLogList = {
  items: SearchLogRow[];
  total: number;
  page: number;
  pageSize: number;
  stats: { total: number; clicks: number; ticket: number; zero: number };
};

/**
 * 기간 → [start, end) UTC 경계 (KST 자정 정렬).
 * Vercel(UTC)에서도 KST 하루 단위로 자르기 위해 KST 날짜를 기준으로 계산.
 *
 * - today    : [오늘 00:00 KST, 현재 시각) — 실시간
 * - 그 외     : [오늘-N일 00:00, 오늘 00:00) — 어제를 끝으로 (오늘 제외)
 */
function kstPeriodRange(period: SearchLogPeriod): { start: Date; end: Date } {
  const now = new Date();
  const todayKst = now
    .toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' })
    .slice(0, 10); // 'YYYY-MM-DD'
  // 오늘 00:00 KST = 어제의 끝.
  const todayStart = new Date(`${todayKst}T00:00:00+09:00`);
  if (period === 'today') {
    return { start: todayStart, end: now };
  }
  const days = period === 'yesterday' ? 1 : period === '7d' ? 7 : 30;
  const start = new Date(todayStart.getTime() - days * 24 * 60 * 60 * 1000);
  return { start, end: todayStart };
}

/** 클릭한 아티클(slug) 메타 — 정식 URL·타이틀 복원용. */
type ArticleMeta = {
  title: string;
  productCode: string;
  contentType: string;
  yes: number;
  no: number;
};

/**
 * 클릭/접수 결과 → 유출 페이지의 {정식 URL, 표시 타이틀}.
 * URL은 실제 라우트 규칙대로 생성(아티클은 /help/{product}/{content_type}/{slug} 3세그먼트).
 * 대상이 삭제돼 메타를 못 찾으면 깨진 링크 대신 url=null(텍스트만)로 안전 처리.
 */
function resolveOutflow(
  row: {
    clicked: boolean;
    clickedKind: string | null;
    clickedRef: string | null;
    ledToTicket: boolean;
  },
  maps: {
    article: Map<string, ArticleMeta>;
    faqTitle: Map<string, string>;
    noticeTitle: Map<string, string>;
  },
): { url: string | null; label: string | null } {
  if (row.clicked && row.clickedKind && row.clickedRef) {
    const ref = row.clickedRef;
    switch (row.clickedKind) {
      case 'help': {
        const a = maps.article.get(ref);
        if (!a) return { url: null, label: '(삭제된 아티클)' };
        return {
          url: `/help/${a.productCode}/${a.contentType}/${ref}`,
          label: a.title,
        };
      }
      case 'faq':
        return {
          url: `/faq#faq-${ref}`,
          label: maps.faqTitle.get(ref) ?? '(삭제된 FAQ)',
        };
      case 'notice':
        return {
          url: `/notices/${ref}`,
          label: maps.noticeTitle.get(ref) ?? '(삭제된 공지)',
        };
      case 'incident':
        return { url: '/status', label: '서비스 상태' };
      default:
        return { url: null, label: row.clickedKind };
    }
  }
  if (row.ledToTicket) return { url: '/tickets/new', label: '티켓 접수' };
  return { url: null, label: null };
}

/**
 * 검색 이력 목록 — 기간 필터 + 페이징.
 * 세션 체류시간은 같은 session_key 내 다음 활동까지의 간격을 LEAD 윈도우로 산출.
 * (윈도우 함수는 WHERE 통과 전체 집합에 대해 LIMIT 이전에 평가되므로 페이지 경계와 무관하게 정확.)
 */
export async function listSearchLogs(input: {
  period: SearchLogPeriod;
  page?: number;
  pageSize?: number;
}): Promise<SearchLogList> {
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, input.pageSize ?? 30));
  const empty: SearchLogList = {
    items: [],
    total: 0,
    page,
    pageSize,
    stats: { total: 0, clicks: 0, ticket: 0, zero: 0 },
  };
  if (!db) return empty;

  try {
    const { start, end } = kstPeriodRange(input.period);
    const where = and(
      gte(searchLogs.createdAt, start),
      lt(searchLogs.createdAt, end),
      eq(searchLogs.isActive, true),
    );

    // 세션 내 다음 활동까지 간격(초). 세션키 없으면 null(단발 취급).
    const dwellExpr = sql<number | null>`case
      when ${searchLogs.sessionKey} is null then null
      else extract(epoch from (
        coalesce(
          lead(${searchLogs.createdAt}) over (
            partition by ${searchLogs.sessionKey} order by ${searchLogs.createdAt}
          ),
          ${searchLogs.updatedAt}
        ) - ${searchLogs.createdAt}
      ))
    end`;

    const [rows, statRows] = await Promise.all([
      db
        .select({
          id: searchLogs.id,
          query: searchLogs.query,
          createdAt: searchLogs.createdAt,
          clicked: searchLogs.clicked,
          clickedKind: searchLogs.clickedKind,
          clickedRef: searchLogs.clickedRef,
          ledToTicket: searchLogs.ledToTicket,
          zeroResult: searchLogs.zeroResult,
          productCode: searchLogs.productCode,
          dwellSeconds: dwellExpr,
        })
        .from(searchLogs)
        .where(where)
        .orderBy(desc(searchLogs.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db
        .select({
          total: sql<number>`count(*)::int`,
          clicks: sql<number>`count(*) filter (where ${searchLogs.clicked})::int`,
          ticket: sql<number>`count(*) filter (where ${searchLogs.ledToTicket})::int`,
          zero: sql<number>`count(*) filter (where ${searchLogs.zeroResult})::int`,
        })
        .from(searchLogs)
        .where(where),
    ]);

    // 클릭해 도착한 대상의 메타(정식 URL·타이틀·반응표)를 종류별로 배치 조회.
    const helpSlugs = [
      ...new Set(
        rows
          .filter((r) => r.clicked && r.clickedKind === 'help' && r.clickedRef)
          .map((r) => r.clickedRef as string),
      ),
    ];
    const faqIds = [
      ...new Set(
        rows
          .filter((r) => r.clicked && r.clickedKind === 'faq' && r.clickedRef)
          .map((r) => r.clickedRef as string),
      ),
    ];
    const noticeIds = [
      ...new Set(
        rows
          .filter((r) => r.clicked && r.clickedKind === 'notice' && r.clickedRef)
          .map((r) => r.clickedRef as string),
      ),
    ];

    const [articleRows, faqRows, noticeRows] = await Promise.all([
      helpSlugs.length
        ? db
            .select({
              slug: articles.slug,
              title: articles.title,
              productCode: articles.productCode,
              contentType: articles.contentType,
              yes: articles.helpfulYes,
              no: articles.helpfulNo,
            })
            .from(articles)
            .where(inArray(articles.slug, helpSlugs))
        : Promise.resolve(
            [] as {
              slug: string;
              title: string;
              productCode: string;
              contentType: string;
              yes: number;
              no: number;
            }[],
          ),
      faqIds.length
        ? db
            .select({
              id: faqs.id,
              question: faqs.question,
              yes: faqs.helpfulYes,
              no: faqs.helpfulNo,
            })
            .from(faqs)
            .where(inArray(faqs.id, faqIds))
        : Promise.resolve(
            [] as { id: string; question: string; yes: number; no: number }[],
          ),
      noticeIds.length
        ? db
            .select({ id: notices.id, title: notices.title })
            .from(notices)
            .where(inArray(notices.id, noticeIds))
        : Promise.resolve([] as { id: string; title: string }[]),
    ]);

    const articleBySlug = new Map<string, ArticleMeta>(
      articleRows.map((a) => [
        a.slug,
        {
          title: a.title,
          productCode: a.productCode,
          contentType: a.contentType,
          yes: a.yes,
          no: a.no,
        },
      ]),
    );
    const faqById = new Map(
      faqRows.map((f) => [f.id, { question: f.question, yes: f.yes, no: f.no }]),
    );
    const noticeTitleById = new Map(noticeRows.map((n) => [n.id, n.title]));

    const outflowMaps = {
      article: articleBySlug,
      faqTitle: new Map(
        faqRows.map((f) => [f.id, f.question] as [string, string]),
      ),
      noticeTitle: noticeTitleById,
    };

    const s = statRows[0];
    const items: SearchLogRow[] = rows.map((r) => {
      const outflow = resolveOutflow(r, outflowMaps);
      const dwell =
        r.dwellSeconds == null ? null : Math.round(Number(r.dwellSeconds));
      let helpful: HelpfulTally | null = null;
      if (r.clicked && r.clickedRef) {
        if (r.clickedKind === 'help') {
          const a = articleBySlug.get(r.clickedRef);
          helpful = a ? { yes: a.yes, no: a.no } : null;
        } else if (r.clickedKind === 'faq') {
          const f = faqById.get(r.clickedRef);
          helpful = f ? { yes: f.yes, no: f.no } : null;
        }
      }
      return {
        id: r.id,
        query: r.query,
        createdAt: r.createdAt,
        dwellSeconds: dwell != null && dwell >= 0 ? dwell : null,
        helpful,
        outflowUrl: outflow.url,
        outflowLabel: outflow.label,
      };
    });

    return {
      items,
      total: Number(s?.total ?? 0),
      page,
      pageSize,
      stats: {
        total: Number(s?.total ?? 0),
        clicks: Number(s?.clicks ?? 0),
        ticket: Number(s?.ticket ?? 0),
        zero: Number(s?.zero ?? 0),
      },
    };
  } catch (err) {
    console.error('[search-logs.listSearchLogs] 실패:', err);
    return empty;
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
