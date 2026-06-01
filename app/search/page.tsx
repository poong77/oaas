/**
 * /search?q=... — 통합 검색 (SS-01).
 *
 * Phase 3:
 *   - 4개 탭: 도움말 · FAQ · 공지 · 장애
 *   - 도움말: articles ILIKE (title/summary/body)
 *   - FAQ: 빈 (Phase 4에서 faqs 테이블)
 *   - 공지: 빈 (Phase 7에서 notices 테이블)
 *   - 장애: service_status (status != 'normal', 최근 30일)
 *   - 필터: 제품
 *   - 정렬: 관련도(기본) / 최신순 / 조회수
 *   - 빈 결과 시 문의 접수 안내
 */

import { Suspense } from 'react';
import { sql, and, desc, gte, ne } from 'drizzle-orm';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { SearchResultsSkeleton } from '@/components/ui/skeletons';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { db } from '@/db';
import { serviceStatus } from '@/db/schema';
import { searchArticles, type SearchArticleHit } from '@/lib/services/articles';
import { searchFaqs, type SearchFaqHit } from '@/lib/services/faqs';
import {
  searchNotices,
  summarizeNoticeBody,
  type SearchNoticeHit,
} from '@/lib/services/notices';
import {
  NOTICE_KIND_CLASSES,
  NOTICE_KIND_META,
} from '@/lib/services/notices-meta';
import { getProductCategories } from '@/lib/services/categories';
import { expandKeywords } from '@/lib/services/synonym-expander';
import { buildHighlightRegex } from '@/lib/text/search-match';
import { logSearch } from '@/lib/services/search-logs';
import { getCurrentUser } from '@/lib/permissions';
import { formatDateKst } from '@/lib/business-hours/format';
import { SearchTabs } from './_components/search-tabs';
import { SearchFilters } from './_components/search-filters';
import { TrackedLink } from './_components/tracked-link';
import { SearchBox } from './_components/search-box';
import { POPULAR_KEYWORDS } from '@/app/_components/home/_constants';

export const dynamic = 'force-dynamic';
export const metadata = { title: '검색 — OA 통합 AS' };

type SearchParams = Promise<{
  q?: string;
  tab?: 'all' | 'help' | 'faq' | 'notice' | 'incident';
  product?: string;
  contentType?: 'howto' | 'feature' | 'troubleshoot';
  sort?: 'relevance' | 'recent' | 'views';
}>;

type IncidentRow = {
  id: string;
  status: string;
  message: string | null;
  startedAt: Date;
};

/** 전체(통합) 탭 항목 — 도움말·FAQ·공지를 한 줄 관련도 순위로 병합. */
type MergedHit = {
  kind: 'help' | 'faq' | 'notice';
  key: string;
  /** 클릭 추적용 ref (help=slug, faq/notice=id). */
  ref: string;
  href: string;
  title: string;
  snippet: string;
  score: number;
  date: Date | null;
  viewCount: number;
  productCode: string | null;
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const query = (sp.q ?? '').trim();
  const tab = sp.tab ?? 'all';
  const sort = sp.sort ?? 'relevance';
  const product = sp.product || undefined;
  const contentType = sp.contentType || undefined;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      {/* 중앙 검색바 — 페이지 자체에서 바로 검색 (2026-06-01) */}
      <div className="flex flex-col items-center gap-4 py-2">
        <h1 className="text-center text-xl font-bold tracking-tight sm:text-2xl">
          {query ? `검색 결과 — "${query}"` : '통합 검색'}
        </h1>
        <SearchBox defaultValue={query} />
      </div>

      {!query ? (
        <ul className="flex flex-wrap items-center justify-center gap-2">
          {POPULAR_KEYWORDS.map((kw) => (
            <li key={kw}>
              <Link
                href={`/search?q=${encodeURIComponent(kw)}`}
                className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-brand-700 dark:hover:bg-brand-950/50 dark:hover:text-brand-300 sm:text-sm"
              >
                # {kw}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        // 쿼리/탭/필터가 바뀔 때마다 key 변경 → 결과를 스트리밍하는 동안 즉시 스켈레톤.
        // (loading.tsx는 /search 최초 진입만 커버하므로, 검색어 변경 대기 체감은 여기서 처리)
        <Suspense
          key={`${query}|${tab}|${sort}|${product ?? ''}|${contentType ?? ''}`}
          fallback={<SearchResultsSkeleton />}
        >
          <SearchResults
            query={query}
            tab={tab}
            sort={sort}
            product={product}
            contentType={contentType}
          />
        </Suspense>
      )}
    </div>
  );
}

async function SearchResults({
  query,
  tab,
  sort,
  product,
  contentType,
}: {
  query: string;
  tab: 'all' | 'help' | 'faq' | 'notice' | 'incident';
  sort: 'relevance' | 'recent' | 'views';
  product?: string;
  contentType?: 'howto' | 'feature' | 'troubleshoot';
}) {
  const categories = await getProductCategories();

  // 결과 카운트는 모든 탭 한꺼번에 가져와서 뱃지로 표시 (단순 N+1)
  let helpHits: SearchArticleHit[] = [];
  let faqHits: SearchFaqHit[] = [];
  let noticeHits: SearchNoticeHit[] = [];
  let incidentRows: IncidentRow[] = [];

  // 하이라이트 정규식 — 검색 서비스와 동일한 동의어 확장 term 기준.
  // 원본 검색어뿐 아니라 동의어로 매칭된 단어도 하이라이트한다.
  let highlightRegex: RegExp | null = null;
  if (query) {
    const expandedTerms = await expandKeywords(query, { maxTokens: 32 });
    highlightRegex = buildHighlightRegex(expandedTerms);
    [helpHits, faqHits, noticeHits, incidentRows] = await Promise.all([
      searchArticles(query, {
        productCode: product,
        contentType,
        limit: 100,
      }),
      searchFaqs(query, { productCode: product, limit: 100 }),
      searchNotices(query, { productCode: product, limit: 100 }),
      fetchRecentIncidents(query),
    ]);
  }

  // 정렬 적용 (탭별)
  const sortedHelp = applySort(helpHits, sort);
  const sortedFaq = applyFaqSort(faqHits, sort);
  const sortedNotice = applyNoticeSort(noticeHits, sort);

  // 전체(통합) 탭 — 도움말·FAQ·공지를 한 리스트로 병합 후 관련도(점수) 순.
  // 골든셋 평가의 통합 순위(searchUnified)와 동일 기준 → 측정=실제화면 일치.
  const mergedAll = buildMerged(helpHits, faqHits, noticeHits);
  const sortedAll = applyMergedSort(mergedAll, sort);

  const counts = {
    all: mergedAll.length,
    help: helpHits.length,
    faq: faqHits.length,
    notice: noticeHits.length,
    incident: incidentRows.length,
  };

  // Layer B — 검색 실사용 로그 (best-effort). logId로 클릭/접수 전환 추적.
  let logId: string | null = null;
  if (query) {
    const me = await getCurrentUser();
    logId = await logSearch({
      query,
      counts,
      productCode: product ?? null,
      userId: me?.id ?? null,
      role: me?.role ?? null,
    });
  }

  return (
    <>
      <SearchTabs counts={counts} current={tab} query={query} />

          {tab === 'all' && (
            <>
              <SearchFilters
                initial={{ product, sort, contentType }}
                categories={categories}
              />
              {sortedAll.length === 0 ? (
                <EmptyResults query={query} logId={logId} />
              ) : (
                <ul className="grid gap-3">
                  {sortedAll.map((m, i) => (
                    <li key={m.key}>
                      <TrackedLink
                        logId={logId}
                        track="click"
                        kind={m.kind}
                        refId={m.ref}
                        position={i + 1}
                        href={m.href}
                        className="hover:border-brand-300 hover:bg-brand-50/30 dark:hover:border-brand-700 dark:hover:bg-brand-950/20 flex flex-col gap-1 rounded-lg border border-slate-200 bg-white p-4 transition-colors dark:border-slate-700 dark:bg-slate-900"
                      >
                        <div className="flex items-center gap-2">
                          <Badge tone={MERGED_KIND_TONE[m.kind]}>
                            {MERGED_KIND_LABEL[m.kind]}
                          </Badge>
                          {m.productCode && (
                            <Badge tone="slate" className="uppercase">
                              {m.productCode}
                            </Badge>
                          )}
                        </div>
                        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                          <Highlight text={m.title} regex={highlightRegex} />
                        </h3>
                        {m.snippet && (
                          <p className="line-clamp-2 text-sm text-slate-600 dark:text-slate-300">
                            <Highlight
                              text={m.snippet}
                              regex={highlightRegex}
                            />
                          </p>
                        )}
                        <div className="mt-1 flex items-center gap-3 text-xs text-slate-400">
                          {m.date && <span>{formatDateKst(m.date)}</span>}
                          <span>조회 {m.viewCount.toLocaleString()}</span>
                        </div>
                      </TrackedLink>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          {tab === 'help' && (
            <>
              <SearchFilters
                initial={{ product, sort, contentType }}
                categories={categories}
              />
              {sortedHelp.length === 0 ? (
                <EmptyResults query={query} logId={logId} />
              ) : (
                <ul className="grid gap-3">
                  {sortedHelp.map((h, i) => (
                    <li key={h.id}>
                      <TrackedLink
                        logId={logId}
                        track="click"
                        kind="help"
                        refId={h.slug}
                        position={i + 1}
                        href={`/help/${h.productCode}/${h.slug}`}
                        className="hover:border-brand-300 hover:bg-brand-50/30 dark:hover:border-brand-700 dark:hover:bg-brand-950/20 flex flex-col gap-1 rounded-lg border border-slate-200 bg-white p-4 transition-colors dark:border-slate-700 dark:bg-slate-900"
                      >
                        <div className="flex items-center gap-2">
                          <Badge tone="brand" className="uppercase">
                            {h.productCode}
                          </Badge>
                          {h.categoryPath?.[0] && (
                            <Badge tone="slate">{h.categoryPath[0]}</Badge>
                          )}
                          {h.titleMatch && (
                            <Badge tone="success">제목 일치</Badge>
                          )}
                        </div>
                        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                          <Highlight text={h.title} regex={highlightRegex} />
                        </h3>
                        {(h.summary ?? h.summary30s) && (
                          <p className="line-clamp-2 text-sm text-slate-600 dark:text-slate-300">
                            <Highlight
                              text={h.summary ?? h.summary30s ?? ''}
                              regex={highlightRegex}
                            />
                          </p>
                        )}
                        <div className="mt-1 flex items-center gap-3 text-xs text-slate-400">
                          {h.publishedAt && (
                            <span>{formatDateKst(h.publishedAt)}</span>
                          )}
                          <span>조회 {h.viewCount.toLocaleString()}</span>
                        </div>
                      </TrackedLink>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          {tab === 'faq' && (
            <>
              <SearchFilters
                initial={{ product, sort, contentType }}
                categories={categories}
              />
              {sortedFaq.length === 0 ? (
                <EmptyResults query={query} kind="faq" logId={logId} />
              ) : (
                <ul className="grid gap-3">
                  {sortedFaq.map((f, i) => (
                    <li key={f.id}>
                      <TrackedLink
                        logId={logId}
                        track="click"
                        kind="faq"
                        refId={f.id}
                        position={i + 1}
                        href={`/faq#faq-${f.id}`}
                        className="hover:border-brand-300 hover:bg-brand-50/30 dark:hover:border-brand-700 dark:hover:bg-brand-950/20 flex flex-col gap-1 rounded-lg border border-slate-200 bg-white p-4 transition-colors dark:border-slate-700 dark:bg-slate-900"
                      >
                        <div className="flex items-center gap-2">
                          <Badge tone="brand" className="uppercase">
                            {f.productCode}
                          </Badge>
                          {f.issueType && (
                            <Badge tone="slate">{f.issueType}</Badge>
                          )}
                          {f.questionMatch && (
                            <Badge tone="success">질문 일치</Badge>
                          )}
                        </div>
                        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                          <Highlight text={f.question} regex={highlightRegex} />
                        </h3>
                        <p className="line-clamp-2 text-sm text-slate-600 dark:text-slate-300">
                          <Highlight
                            text={f.answerMarkdown}
                            regex={highlightRegex}
                          />
                        </p>
                        <div className="mt-1 flex items-center gap-3 text-xs text-slate-400">
                          <span>조회 {f.viewCount.toLocaleString()}</span>
                          <span>
                            도움됨 {f.helpfulYes}/{f.helpfulNo}
                          </span>
                        </div>
                      </TrackedLink>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          {tab === 'notice' && (
            <>
              <SearchFilters
                initial={{ product, sort, contentType }}
                categories={categories}
              />
              {sortedNotice.length === 0 ? (
                <EmptyResults query={query} kind="notice" logId={logId} />
              ) : (
                <ul className="grid gap-3">
                  {sortedNotice.map((n, i) => {
                    const meta = NOTICE_KIND_META[n.kind];
                    const kindClass = NOTICE_KIND_CLASSES[n.kind];
                    return (
                      <li key={n.id}>
                        <TrackedLink
                          logId={logId}
                          track="click"
                          kind="notice"
                          refId={n.id}
                          position={i + 1}
                          href={`/notices/${n.id}`}
                          className="hover:border-brand-300 hover:bg-brand-50/30 dark:hover:border-brand-700 dark:hover:bg-brand-950/20 flex flex-col gap-1 rounded-lg border border-slate-200 bg-white p-4 transition-colors dark:border-slate-700 dark:bg-slate-900"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${kindClass}`}
                            >
                              {meta.label}
                            </span>
                            {n.productCode && (
                              <Badge tone="slate" className="uppercase">
                                {n.productCode}
                              </Badge>
                            )}
                            {n.pinned && <Badge tone="warn">고정</Badge>}
                            {n.titleMatch && (
                              <Badge tone="success">제목 일치</Badge>
                            )}
                          </div>
                          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                            <Highlight text={n.title} regex={highlightRegex} />
                          </h3>
                          <p className="line-clamp-2 text-sm text-slate-600 dark:text-slate-300">
                            <Highlight
                              text={summarizeNoticeBody(n.bodyMarkdown, 140)}
                              regex={highlightRegex}
                            />
                          </p>
                          <div className="mt-1 flex items-center gap-3 text-xs text-slate-400">
                            {n.publishedAt && (
                              <span>{formatDateKst(n.publishedAt)}</span>
                            )}
                            <span>조회 {n.viewCount.toLocaleString()}</span>
                          </div>
                        </TrackedLink>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}

          {tab === 'incident' && (
            <>
              {incidentRows.length === 0 ? (
                <EmptyResults query={query} kind="incident" logId={logId} />
              ) : (
                <ul className="grid gap-3">
                  {incidentRows.map((row) => (
                    <li
                      key={row.id}
                      className="rounded-lg border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900 dark:bg-amber-950/30"
                    >
                      <div className="flex items-center gap-2">
                        <Badge tone="warn">{row.status}</Badge>
                        <span className="text-xs text-slate-500">
                          {formatDateKst(row.startedAt)}
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-medium">
                        {row.message ?? '(메시지 없음)'}
                      </p>
                      <Link
                        href="/status"
                        className="text-brand-600 mt-2 inline-block text-xs hover:underline"
                      >
                        서비스 상태 페이지에서 자세히 보기 →
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </>
  );
}

async function fetchRecentIncidents(q: string): Promise<IncidentRow[]> {
  if (!db) return [];
  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const pattern = `%${q.trim()}%`;
    const rows = await db
      .select({
        id: serviceStatus.id,
        status: serviceStatus.status,
        message: serviceStatus.message,
        startedAt: serviceStatus.startedAt,
      })
      .from(serviceStatus)
      .where(
        and(
          ne(serviceStatus.status, 'normal'),
          gte(serviceStatus.createdAt, since),
          // 메시지 ILIKE OR status ILIKE
          sql`(${serviceStatus.message} ILIKE ${pattern} OR ${serviceStatus.status}::text ILIKE ${pattern})`,
        ),
      )
      .orderBy(desc(serviceStatus.startedAt))
      .limit(20);
    return rows;
  } catch (err) {
    console.error('[search.fetchRecentIncidents] 실패:', err);
    return [];
  }
}

const MERGED_KIND_LABEL: Record<MergedHit['kind'], string> = {
  help: '도움말',
  faq: 'FAQ',
  notice: '공지',
};
const MERGED_KIND_TONE: Record<
  MergedHit['kind'],
  'brand' | 'success' | 'warn'
> = {
  help: 'brand',
  faq: 'success',
  notice: 'warn',
};

/** 도움말·FAQ·공지를 단일 MergedHit[] 로 병합 (전체 탭). */
function buildMerged(
  help: SearchArticleHit[],
  faq: SearchFaqHit[],
  notice: SearchNoticeHit[],
): MergedHit[] {
  const out: MergedHit[] = [];
  for (const h of help)
    out.push({
      kind: 'help',
      key: `help:${h.slug}`,
      ref: h.slug,
      href: `/help/${h.productCode}/${h.slug}`,
      title: h.title,
      snippet: h.summary ?? h.summary30s ?? '',
      score: h.score,
      date: h.publishedAt ?? null,
      viewCount: h.viewCount,
      productCode: h.productCode,
    });
  for (const f of faq)
    out.push({
      kind: 'faq',
      key: `faq:${f.id}`,
      ref: f.id,
      href: `/faq#faq-${f.id}`,
      title: f.question,
      snippet: f.answerMarkdown,
      score: f.score,
      date: f.createdAt ? new Date(f.createdAt) : null,
      viewCount: f.viewCount,
      productCode: f.productCode,
    });
  for (const n of notice)
    out.push({
      kind: 'notice',
      key: `notice:${n.id}`,
      ref: n.id,
      href: `/notices/${n.id}`,
      title: n.title,
      snippet: summarizeNoticeBody(n.bodyMarkdown, 140),
      score: n.score,
      date: n.publishedAt ?? null,
      viewCount: n.viewCount,
      productCode: n.productCode,
    });
  return out;
}

function applyMergedSort(
  hits: MergedHit[],
  sort: 'relevance' | 'recent' | 'views',
): MergedHit[] {
  const t = (d: Date | null) => (d ? new Date(d).getTime() : 0);
  if (sort === 'recent') return [...hits].sort((a, b) => t(b.date) - t(a.date));
  if (sort === 'views')
    return [...hits].sort((a, b) => b.viewCount - a.viewCount);
  // relevance: 점수 desc → 최신
  return [...hits].sort((a, b) =>
    b.score !== a.score ? b.score - a.score : t(b.date) - t(a.date),
  );
}

function applySort(
  hits: SearchArticleHit[],
  sort: 'relevance' | 'recent' | 'views',
): SearchArticleHit[] {
  if (sort === 'recent') {
    return [...hits].sort((a, b) => {
      const da = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const db = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return db - da;
    });
  }
  if (sort === 'views') {
    return [...hits].sort((a, b) => b.viewCount - a.viewCount);
  }
  // relevance: score desc, then recent
  return [...hits].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const da = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const db = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    return db - da;
  });
}

function applyNoticeSort(
  hits: SearchNoticeHit[],
  sort: 'relevance' | 'recent' | 'views',
): SearchNoticeHit[] {
  if (sort === 'recent') {
    return [...hits].sort((a, b) => {
      const da = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const db = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return db - da;
    });
  }
  if (sort === 'views') {
    return [...hits].sort((a, b) => b.viewCount - a.viewCount);
  }
  // relevance: pinned 우선 → score desc → recent
  return [...hits].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (b.score !== a.score) return b.score - a.score;
    const da = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const db = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    return db - da;
  });
}

function applyFaqSort(
  hits: SearchFaqHit[],
  sort: 'relevance' | 'recent' | 'views',
): SearchFaqHit[] {
  if (sort === 'recent') {
    return [...hits].sort((a, b) => {
      const da = new Date(a.createdAt).getTime();
      const db = new Date(b.createdAt).getTime();
      return db - da;
    });
  }
  if (sort === 'views') {
    return [...hits].sort((a, b) => b.viewCount - a.viewCount);
  }
  return [...hits].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.sortOrder - b.sortOrder;
  });
}

function EmptyResults({
  query,
  kind,
  logId,
}: {
  query: string;
  kind?: 'incident' | 'faq' | 'notice';
  logId?: string | null;
}) {
  const title =
    kind === 'incident'
      ? '최근 30일간 관련 장애가 없습니다'
      : kind === 'faq'
        ? `"${query}"에 대한 FAQ가 없습니다`
        : kind === 'notice'
          ? `"${query}"에 대한 공지가 없습니다`
          : `"${query}"에 대한 검색 결과가 없습니다`;
  return (
    <Card>
      <CardContent className="p-6">
        <EmptyState
          icon={<Search className="h-6 w-6" />}
          title={title}
          description="다른 키워드를 시도하거나 직접 문의를 접수하세요."
          action={
            <Button asChild size="sm">
              {/* 검색→접수 전환(deflection 실패) 추적 */}
              <TrackedLink
                logId={logId ?? null}
                track="ticket"
                href={`/tickets/new?q=${encodeURIComponent(query)}`}
              >
                문의 접수
              </TrackedLink>
            </Button>
          }
        />
      </CardContent>
    </Card>
  );
}

/**
 * 확장 term(동의어 포함) 모두를 하이라이트.
 *
 * buildHighlightRegex가 단일 캡처 그룹 정규식을 만들므로 split 결과의
 * 홀수 인덱스가 매칭 구간이다. regex가 null이면 원문 그대로 출력.
 */
function Highlight({ text, regex }: { text: string; regex: RegExp | null }) {
  if (!regex || !text) return <>{text}</>;
  const parts = text.split(regex);
  if (parts.length === 1) return <>{text}</>;
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark
            key={i}
            className="rounded bg-yellow-200 px-0.5 dark:bg-yellow-900 dark:text-yellow-50"
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}
