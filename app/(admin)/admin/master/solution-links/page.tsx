/**
 * /admin/master/solution-links — 솔루션 링크 프리셋 (Phase 9).
 */

import Link from 'next/link';
import { ArrowLeft, Link as LinkIcon, Plus } from 'lucide-react';

import { requireRole } from '@/lib/permissions';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { listSolutionLinkPresets } from '@/lib/services/master-solution-links';
import { resolveIcon } from '@/components/icon-resolver';

export const dynamic = 'force-dynamic';
export const metadata = { title: '솔루션 링크 프리셋 — 마스터DB' };

export default async function MasterSolutionLinksPage() {
  await requireRole(['manager', 'admin']);
  const items = await listSolutionLinkPresets(true);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="솔루션 링크 프리셋"
        description="호텔 프로필에서 사용자가 솔루션 링크를 추가할 때 보여지는 후보 목록."
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
            <Link href="/admin/master/solution-links/new">
              <Plus className="h-4 w-4" /> 신규
            </Link>
          </Button>
        }
      />
      {items.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <EmptyState
              icon={<LinkIcon className="h-6 w-6" />}
              title="등록된 프리셋이 없습니다"
              action={
                <Button asChild size="sm">
                  <Link href="/admin/master/solution-links/new">신규 추가</Link>
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {items.map((it) => {
                const Icon = resolveIcon(it.icon);
                return (
                  <li
                    key={it.id}
                    className={`flex items-center justify-between gap-3 p-4 hover:bg-slate-50 dark:hover:bg-slate-900/40 ${
                      it.isActive ? '' : 'opacity-50'
                    }`}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-300">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold">
                            {it.label}
                          </span>
                          <Badge tone="slate">정렬 {it.sortOrder}</Badge>
                          {!it.isActive && <Badge tone="danger">비활성</Badge>}
                        </div>
                        {it.defaultUrlTemplate && (
                          <code className="truncate font-mono text-[10px] text-slate-400 dark:text-slate-500">
                            {it.defaultUrlTemplate}
                          </code>
                        )}
                      </div>
                    </div>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/admin/master/solution-links/${it.id}`}>
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
