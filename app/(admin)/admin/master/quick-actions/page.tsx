/**
 * /admin/master/quick-actions — 자주 찾는 작업 (Phase 9).
 * 홈 LP-01 ④ 카드. visible=true + is_active=true 만 홈에 노출.
 */

import Link from 'next/link';
import { ArrowLeft, Plus, Sparkles } from 'lucide-react';

import { requireRole } from '@/lib/permissions';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { listQuickActions } from '@/lib/services/master-quick-actions';
import { resolveIcon } from '@/components/icon-resolver';

export const dynamic = 'force-dynamic';
export const metadata = { title: '자주 찾는 작업 — 마스터DB' };

export default async function MasterQuickActionsPage() {
  await requireRole(['manager', 'admin']);
  const items = await listQuickActions({
    includeHidden: true,
    includeInactive: true,
  });
  const visibleCount = items.filter((i) => i.visible && i.isActive).length;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="자주 찾는 작업"
        description={`홈 페이지 ④ 카드. 가시 / 활성 (${visibleCount}건) 만 사용자에게 노출.`}
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
            <Link href="/admin/master/quick-actions/new">
              <Plus className="h-4 w-4" /> 신규
            </Link>
          </Button>
        }
      />

      {items.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <EmptyState
              icon={<Sparkles className="h-6 w-6" />}
              title="등록된 항목이 없습니다"
              description="홈 ④ 카드용 단축 메뉴를 추가하세요. DB에 row 없으면 _constants.ts의 하드코딩 fallback이 표시됩니다."
              action={
                <Button asChild size="sm">
                  <Link href="/admin/master/quick-actions/new">신규 추가</Link>
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {items.map((qa) => {
                const Icon = resolveIcon(qa.icon);
                return (
                  <li
                    key={qa.id}
                    className={`flex items-center justify-between gap-3 p-4 hover:bg-slate-50 dark:hover:bg-slate-900/40 ${
                      qa.isActive ? '' : 'opacity-50'
                    }`}
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-300">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {qa.label}
                          </span>
                          {!qa.visible && <Badge tone="warn">숨김</Badge>}
                          {!qa.isActive && <Badge tone="danger">비활성</Badge>}
                          <Badge tone="slate">정렬 {qa.sortOrder}</Badge>
                        </div>
                        {qa.description && (
                          <span className="line-clamp-1 text-xs text-slate-500 dark:text-slate-400">
                            {qa.description}
                          </span>
                        )}
                        <code className="truncate font-mono text-[10px] text-slate-400">
                          {qa.linkUrl}
                        </code>
                      </div>
                    </div>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/admin/master/quick-actions/${qa.id}`}>
                        편집
                      </Link>
                    </Button>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
