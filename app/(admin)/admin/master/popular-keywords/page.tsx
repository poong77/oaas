/**
 * /admin/master/popular-keywords — 인기검색어 하이브리드 큐레이션 (SS-04).
 *
 * 평상시 노출은 search_logs 자동집계. 어드민은 pin(고정)/block(제외)만 관리.
 *   - 상단: 현재 노출 미리보기 (사용자가 보는 칩 그대로)
 *   - 고정(pin) / 제외(block) 목록
 *   - 최근 30일 자동집계 top — "고정"·"제외" 한 번에 추가
 */

import Link from 'next/link';
import {
  ArrowLeft,
  Ban,
  Hash,
  Pin,
  Plus,
  TrendingUp,
} from 'lucide-react';

import { requireRole } from '@/lib/permissions';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import {
  listPopularKeywords,
  resolvePopularKeywords,
} from '@/lib/services/master-popular-keywords';
import { topQueries } from '@/lib/services/search-logs';
import { normalizeTerm } from '@/lib/text/normalize';

export const dynamic = 'force-dynamic';
export const metadata = { title: '인기검색어 — 마스터DB' };

export default async function MasterPopularKeywordsPage() {
  await requireRole(['manager', 'admin']);

  const [all, preview, auto] = await Promise.all([
    listPopularKeywords({ includeInactive: true }),
    resolvePopularKeywords(),
    topQueries(30, 15),
  ]);

  const pins = all.filter((r) => r.kind === 'pin');
  const blocks = all.filter((r) => r.kind === 'block');
  const blockedNorm = new Set(
    blocks.filter((b) => b.isActive).map((b) => b.normalizedKeyword),
  );
  const pinnedNorm = new Set(
    pins.filter((p) => p.isActive).map((p) => normalizeTerm(p.keyword)),
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="인기검색어"
        description="평상시엔 실사용 검색로그(최근 30일)에서 자동 집계됩니다. 고정(pin)으로 항상 상단에 두거나, 제외(block)로 노이즈를 숨길 수 있습니다."
        breadcrumb={
          <Link
            href="/admin/master"
            className="inline-flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <ArrowLeft className="h-3 w-3" /> 마스터DB
          </Link>
        }
        actions={
          <Button asChild>
            <Link href="/admin/master/popular-keywords/new">
              <Plus className="h-4 w-4" /> 신규
            </Link>
          </Button>
        }
      />

      {/* 현재 노출 미리보기 */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-5">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            현재 노출 미리보기 (홈 · 검색 화면)
          </span>
          <ul className="flex flex-wrap items-center gap-2">
            {preview.map((kw) => (
              <li
                key={kw}
                className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 sm:text-sm"
              >
                # {kw}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* 고정(pin) */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-5">
          <div className="flex items-center gap-2">
            <Pin className="h-4 w-4 text-brand-600 dark:text-brand-300" />
            <span className="text-sm font-semibold">고정 (pin)</span>
            <Badge tone="slate">{pins.length}</Badge>
          </div>
          {pins.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              고정된 키워드가 없습니다. 자동집계만으로 노출됩니다.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
              {pins.map((p) => (
                <li
                  key={p.id}
                  className={`flex items-center justify-between gap-3 py-2.5 ${
                    p.isActive ? '' : 'opacity-50'
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      # {p.keyword}
                    </span>
                    <Badge tone="slate">정렬 {p.sortOrder}</Badge>
                    {!p.isActive && <Badge tone="danger">비활성</Badge>}
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/admin/master/popular-keywords/${p.id}`}>
                      편집
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* 제외(block) */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-5">
          <div className="flex items-center gap-2">
            <Ban className="h-4 w-4 text-rose-600 dark:text-rose-400" />
            <span className="text-sm font-semibold">제외 (block)</span>
            <Badge tone="slate">{blocks.length}</Badge>
          </div>
          {blocks.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              제외 키워드가 없습니다.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {blocks.map((b) => (
                <li key={b.id}>
                  <Link
                    href={`/admin/master/popular-keywords/${b.id}`}
                    className={`inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs text-rose-700 hover:border-rose-400 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300 ${
                      b.isActive ? '' : 'opacity-50'
                    }`}
                  >
                    <Ban className="h-3 w-3" /> {b.keyword}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* 자동집계 top */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-5">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-slate-500 dark:text-slate-400" />
            <span className="text-sm font-semibold">
              자동집계 — 최근 30일 검색 top
            </span>
          </div>
          {auto.length === 0 ? (
            <EmptyState
              icon={<Hash className="h-6 w-6" />}
              title="집계된 검색 기록이 없습니다"
              description="실사용 검색이 쌓이면 여기에 표시됩니다. 그 전까지는 고정(pin) 또는 _constants.ts fallback이 노출됩니다."
            />
          ) : (
            <ul className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
              {auto.map((a, i) => {
                const isBlocked = blockedNorm.has(a.query);
                const isPinned = pinnedNorm.has(a.query);
                return (
                  <li
                    key={a.query}
                    className="flex items-center justify-between gap-3 py-2.5"
                  >
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="w-5 text-right text-xs tabular-nums text-slate-400 dark:text-slate-500">
                        {i + 1}
                      </span>
                      <span className="truncate text-sm text-slate-800 dark:text-slate-200">
                        {a.query}
                      </span>
                      <Badge tone="slate">{a.count}회</Badge>
                      {isPinned && <Badge tone="brand">고정됨</Badge>}
                      {isBlocked && <Badge tone="danger">제외됨</Badge>}
                    </div>
                    {!isPinned && !isBlocked && (
                      <div className="flex shrink-0 items-center gap-1.5">
                        <Button asChild size="sm" variant="outline">
                          <Link
                            href={`/admin/master/popular-keywords/new?keyword=${encodeURIComponent(
                              a.query,
                            )}&kind=pin`}
                          >
                            <Pin className="h-3 w-3" /> 고정
                          </Link>
                        </Button>
                        <Button asChild size="sm" variant="ghost">
                          <Link
                            href={`/admin/master/popular-keywords/new?keyword=${encodeURIComponent(
                              a.query,
                            )}&kind=block`}
                          >
                            <Ban className="h-3 w-3" /> 제외
                          </Link>
                        </Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
