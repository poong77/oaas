'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Pencil,
  Trash2,
  Undo2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useConfirmDialog } from '@/components/dialogs/confirm-dialog';
import { formatDateKst } from '@/lib/business-hours/format';
import type { ChecklistListItem } from '@/lib/services/checklists';
import type { ProductCategoryView } from '@/lib/services/categories';
import {
  archiveChecklistAction,
  restoreChecklistAction,
} from '@/app/actions/checklist-actions';

export function ChecklistsListClient({
  items,
  productMap,
  total,
  page,
  pageSize,
}: {
  items: ChecklistListItem[];
  productMap: Record<string, ProductCategoryView>;
  total: number;
  page: number;
  pageSize: number;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const confirm = useConfirmDialog();
  const [pending, startTransition] = useTransition();
  const lastPage = Math.max(1, Math.ceil(total / pageSize));

  function go(p: number) {
    const next = new URLSearchParams(sp.toString());
    next.set('page', String(p));
    router.push(`/admin/checklists?${next.toString()}`);
  }

  async function handleArchive(c: ChecklistListItem) {
    const ok = await confirm({
      title: '체크리스트를 비활성 처리하시겠습니까?',
      description: `"${c.title}"이(가) 호텔리어에게서 숨겨집니다. 언제든 복구할 수 있습니다.`,
      confirmText: '비활성',
      tone: 'danger',
    });
    if (!ok) return;
    startTransition(async () => {
      const r = await archiveChecklistAction(c.id);
      if (r.ok) {
        toast.success('비활성 처리되었습니다');
        router.refresh();
      } else toast.error(r.message ?? '처리 실패');
    });
  }

  async function handleRestore(c: ChecklistListItem) {
    const ok = await confirm({
      title: '복구하시겠습니까?',
      description: `"${c.title}"을(를) 다시 활성 상태로 되돌립니다.`,
      confirmText: '복구',
    });
    if (!ok) return;
    startTransition(async () => {
      const r = await restoreChecklistAction(c.id);
      if (r.ok) {
        toast.success('복구되었습니다');
        router.refresh();
      } else toast.error(r.message ?? '처리 실패');
    });
  }

  function productLabel(code: string): string {
    return productMap[code]?.label ?? code;
  }

  function successRate(c: ChecklistListItem): string {
    const completed = c.resolvedCount + c.escalatedCount;
    if (completed === 0) return '-';
    return `${Math.round((c.resolvedCount / completed) * 100)}%`;
  }

  return (
    <>
      {/* 데스크탑 */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900/50 dark:text-slate-400">
            <tr>
              <th className="px-3 py-2 text-left">제목 / 제품</th>
              <th className="px-3 py-2 text-right">단계</th>
              <th className="px-3 py-2 text-right">진행</th>
              <th className="px-3 py-2 text-right">해결률</th>
              <th className="px-3 py-2 text-right">정렬</th>
              <th className="px-3 py-2 text-left">수정</th>
              <th className="px-3 py-2 text-right">작업</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {items.map((c) => (
              <tr key={c.id} className={c.isActive ? '' : 'opacity-60'}>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Badge tone="brand" className="uppercase">
                      {productLabel(c.productCode)}
                    </Badge>
                    {!c.isActive && <Badge tone="danger">비활성</Badge>}
                  </div>
                  <Link
                    href={`/admin/checklists/${c.id}`}
                    className="mt-1 block font-medium hover:underline"
                  >
                    {c.title}
                  </Link>
                  {c.description && (
                    <div className="text-xs text-slate-500 line-clamp-1">
                      {c.description}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {c.stepCount}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {c.viewCount.toLocaleString()}
                </td>
                <td className="px-3 py-2 text-right text-xs">
                  <div>
                    <span className="text-emerald-600">{c.resolvedCount}</span>
                    <span className="text-slate-400"> / </span>
                    <span className="text-amber-500">{c.escalatedCount}</span>
                  </div>
                  <div className="text-slate-400">{successRate(c)}</div>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {c.sortOrder}
                </td>
                <td className="px-3 py-2 text-xs text-slate-500">
                  {formatDateKst(c.updatedAt)}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center justify-end gap-1">
                    <Button asChild size="sm" variant="ghost" title="편집">
                      <Link href={`/admin/checklists/${c.id}`}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                    <Button asChild size="sm" variant="ghost" title="공개 페이지">
                      <Link href={`/troubleshoot/${c.id}`} target="_blank">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                    {c.isActive ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        onClick={() => handleArchive(c)}
                        title="비활성"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        onClick={() => handleRestore(c)}
                        title="복구"
                      >
                        <Undo2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 모바일 카드뷰 */}
      <div className="flex flex-col gap-2 p-3 md:hidden">
        {items.map((c) => (
          <div
            key={c.id}
            className={`flex flex-col gap-2 rounded-md border border-slate-200 p-3 dark:border-slate-800 ${c.isActive ? '' : 'opacity-60'}`}
          >
            <div className="flex items-center gap-2">
              <Badge tone="brand" className="uppercase">
                {productLabel(c.productCode)}
              </Badge>
              <Badge tone="slate">{c.stepCount}단계</Badge>
              {!c.isActive && <Badge tone="danger">비활성</Badge>}
            </div>
            <Link
              href={`/admin/checklists/${c.id}`}
              className="font-semibold hover:underline"
            >
              {c.title}
            </Link>
            {c.description && (
              <p className="text-xs text-slate-500 line-clamp-2">
                {c.description}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
              <span>진행 {c.viewCount.toLocaleString()}</span>
              <span>
                해결 <span className="text-emerald-600">{c.resolvedCount}</span>
                /접수 <span className="text-amber-500">{c.escalatedCount}</span>
              </span>
              <span>정렬 {c.sortOrder}</span>
              <span>{formatDateKst(c.updatedAt)}</span>
            </div>
            <div className="flex items-center gap-1">
              <Button asChild size="sm" variant="outline">
                <Link href={`/admin/checklists/${c.id}`}>편집</Link>
              </Button>
              {c.isActive ? (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => handleArchive(c)}
                >
                  비활성
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => handleRestore(c)}
                >
                  복구
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {lastPage > 1 && (
        <div className="flex items-center justify-between border-t border-slate-200 px-3 py-3 text-sm dark:border-slate-800">
          <div className="text-xs text-slate-500">
            {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} / {total}
          </div>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => go(page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
              이전
            </Button>
            <span className="px-2 text-sm font-medium">
              {page} / {lastPage}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= lastPage}
              onClick={() => go(page + 1)}
            >
              다음
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

