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

import { sql, and, desc, gte, ne } from 'drizzle-orm';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { db } from '@/db';
import { serviceStatus } from '@/db/schema';
import { searchArticles, type SearchArticleHit } from '@/lib/services/articles';
import { getProductCategories } from '@/lib/services/categories';
import { SearchTabs } from './_components/search-tabs';
import { SearchFilters } from './_components/search-filters';

export const dynamic = 'force-dynamic';
export const metadata = { title: '검색 — OA 통합 AS' };

type SearchParams = Promise<{
  q?: string;
  tab?: 'help' | 'faq' | 'notice' | 'incident';
  product?: string;
  sort?: 'relevance' | 'recent' | 'views';
}>;

type IncidentRow = {
  id: string;
  status: string;
  message: string | null;
  startedAt: Date;
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const query = (sp.q ?? '').trim();
  const tab = sp.tab ?? 'help';
  const sort = sp.sort ?? 'relevance';
  const product = sp.product || undefined;

  const categories = await getProductCategories();

  // 결과 카운트는 모든 탭 한꺼번에 가져와서 뱃지로 표시 (단순 N+1)
  let helpHits: SearchArticleHit[] = [];
  let incidentRows: IncidentRow[] = [];

  if (query) {
    helpHits = await searchArticles(query, {
      productCode: product,
      limit: 100,
    });
    incidentRows = await fetchRecentIncidents(query);
  }

  // 정렬 적용 (도움말 탭만)
  const sortedHelp = applySort(helpHits, sort);

  const counts = {
    help: helpHits.length,
    faq: 0, // Phase 4
    notice: 0, // Phase 7
    incident: incidentRows.length,
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <PageHeader
        title={query ? `검색 결과 — "${query}"` : '검색'}
        description={
          query
            ? '도움말·FAQ·공지·장애를 통합 검색합니다.'
            : '검색어를 입력하면 도움말·FAQ·공지·장애를 통합 검색합니다.'
        }
      />

      {!query ? (
        <Card>
          <CardContent className="p-6">
            <EmptyState
              icon={<Search className="h-6 w-6" />}
              title="검색어를 입력하세요"
              description="상단 검색창에서 키워드(예: 결제 오류, SSL 갱신, 카드키 발급)를 입력하면 결과가 표시됩니다."
              action={
                <Button asChild variant="outline" size="sm">
                  <Link href="/">홈으로 돌아가기</Link>
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <SearchTabs counts={counts} current={tab} query={query} />

          {tab === 'help' && (
            <>
              <SearchFilters
                initial={{ product, sort }}
                categories={categories}
              />
              {sortedHelp.length === 0 ? (
                <EmptyResults query={query} />
              ) : (
                <ul className="grid gap-3">
                  {sortedHelp.map((h) => (
                    <li key={h.id}>
                      <Link
                        href={`/help/${h.productCode}/${h.slug}`}
                        className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-white p-4 transition-colors hover:border-brand-300 hover:bg-brand-50/30 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-brand-700 dark:hover:bg-brand-950/20"
                      >
                        <div className="flex items-center gap-2">
                          <Badge tone="brand" className="uppercase">
                            {h.productCode}
                          </Badge>
                          {h.categoryPath?.[0] && (
                            <Badge tone="slate">{h.categoryPath[0]}</Badge>
                          )}
                          {h.score >= 2 && (
                            <Badge tone="success">제목 일치</Badge>
                          )}
                        </div>
                        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                          <Highlight text={h.title} query={query} />
                        </h3>
                        {h.summary30s && (
                          <p className="line-clamp-2 text-sm text-slate-600 dark:text-slate-300">
                            <Highlight text={h.summary30s} query={query} />
                          </p>
                        )}
                        <div className="mt-1 flex items-center gap-3 text-xs text-slate-400">
                          {h.publishedAt && (
                            <span>{formatDate(h.publishedAt)}</span>
                          )}
                          <span>조회 {h.viewCount.toLocaleString()}</span>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          {tab === 'faq' && (
            <Card>
              <CardContent className="p-6">
                <EmptyState
                  icon={<Search className="h-6 w-6" />}
                  title="FAQ 검색은 Phase 4에서 추가됩니다"
                  description="FAQ 시스템이 준비되면 이 탭에서도 결과가 표시됩니다. 그동안 도움말 탭을 활용해주세요."
                />
              </CardContent>
            </Card>
          )}

          {tab === 'notice' && (
            <Card>
              <CardContent className="p-6">
                <EmptyState
                  icon={<Search className="h-6 w-6" />}
                  title="공지 검색은 Phase 7에서 추가됩니다"
                  description="공지/업데이트 시스템이 준비되면 이 탭에서 결과가 표시됩니다."
                />
              </CardContent>
            </Card>
          )}

          {tab === 'incident' && (
            <>
              {incidentRows.length === 0 ? (
                <EmptyResults query={query} kind="incident" />
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
                          {formatDate(row.startedAt)}
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-medium">
                        {row.message ?? '(메시지 없음)'}
                      </p>
                      <Link
                        href="/status"
                        className="mt-2 inline-block text-xs text-brand-600 hover:underline"
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
      )}
    </div>
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

function EmptyResults({
  query,
  kind,
}: {
  query: string;
  kind?: 'incident';
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <EmptyState
          icon={<Search className="h-6 w-6" />}
          title={
            kind === 'incident'
              ? '최근 30일간 관련 장애가 없습니다'
              : `"${query}"에 대한 검색 결과가 없습니다`
          }
          description="다른 키워드를 시도하거나 직접 문의를 접수하세요."
          action={
            <Button asChild size="sm">
              <Link href={`/tickets/new?q=${encodeURIComponent(query)}`}>
                문의 접수
              </Link>
            </Button>
          }
        />
      </CardContent>
    </Card>
  );
}

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query || !text) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded bg-yellow-200 px-0.5 dark:bg-yellow-900 dark:text-yellow-50">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

function formatDate(d: Date | string | null): string {
  if (!d) return '-';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(date.getTime())) return '-';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
