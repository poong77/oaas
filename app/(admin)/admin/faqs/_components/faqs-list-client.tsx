'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Pencil,
  ThumbsUp,
  Trash2,
  Undo2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useConfirmDialog } from '@/components/dialogs/confirm-dialog';
import type { FaqListItem } from '@/lib/services/faqs';
import type { ProductCategoryView } from '@/lib/services/categories';
import {
  archiveFaqAction,
  moveFaqOrderAction,
  restoreFaqAction,
} from '@/app/actions/faq-actions';

export function FaqsListClient({
  items,
  productMap,
  issueTypeMap,
  total,
  page,
  pageSize,
}: {
  items: FaqListItem[];
  productMap: Record<string, ProductCategoryView>;
  issueTypeMap: Record<string, string>;
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
    router.push(`/admin/faqs?${next.toString()}`);
  }

  async function handleArchive(f: FaqListItem) {
    const ok = await confirm({
      title: 'FAQ를 비활성 처리하시겠습니까?',
      description: `"${f.question}"이(가) 호텔리어에게서 숨겨집니다. 언제든 복구할 수 있습니다.`,
      confirmText: '비활성',
      tone: 'danger',
    });
    if (!ok) return;
    startTransition(async () => {
      const r = await archiveFaqAction(f.id);
      if (r.ok) {
        toast.success('비활성 처리되었습니다');
        router.refresh();
      } else toast.error(r.message ?? '처리 실패');
    });
  }

  async function handleRestore(f: FaqListItem) {
    const ok = await confirm({
      title: '복구하시겠습니까?',
      description: `"${f.question}"을(를) 다시 활성 상태로 되돌립니다.`,
      confirmText: '복구',
    });
    if (!ok) return;
    startTransition(async () => {
      const r = await restoreFaqAction(f.id);
      if (r.ok) {
        toast.success('복구되었습니다');
        router.refresh();
      } else toast.error(r.message ?? '처리 실패');
    });
  }

  function handleMove(f: FaqListItem, direction: 'up' | 'down') {
    startTransition(async () => {
      const r = await moveFaqOrderAction(f.id, direction);
      if (r.ok) {
        router.refresh();
      } else if (r.message === 'NO_NEIGHBOR') {
        toast.info('더 이동할 인접 항목이 없습니다.');
      } else {
        toast.error(r.message ?? '이동 실패');
      }
    });
  }

  function productLabel(code: string): string {
    return productMap[code]?.label ?? code;
  }

  function issueLabel(code: string | null): string | null {
    if (!code) return null;
    return issueTypeMap[code] ?? code;
  }

  return (
    <>
      {/* 데스크탑 */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900/50 dark:text-slate-400">
            <tr>
              <th className="px-3 py-2 text-left">질문 / 제품</th>
              <th className="px-3 py-2 text-left">유형</th>
              <th className="px-3 py-2 text-right">정렬</th>
              <th className="px-3 py-2 text-right">조회</th>
              <th className="px-3 py-2 text-right">도움됨</th>
              <th className="px-3 py-2 text-left">수정</th>
              <th className="px-3 py-2 text-right">작업</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {items.map((f) => (
              <tr key={f.id} className={f.isActive ? '' : 'opacity-60'}>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Badge tone="brand" className="uppercase">
                      {productLabel(f.productCode)}
                    </Badge>
                    {!f.isActive && (
                      <Badge tone="danger">비활성</Badge>
                    )}
                  </div>
                  <Link
                    href={`/admin/faqs/${f.id}`}
                    className="mt-1 block font-medium hover:underline"
                  >
                    {f.question}
                  </Link>
                </td>
                <td className="px-3 py-2 text-xs">
                  {issueLabel(f.issueType) ?? '-'}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  <div className="inline-flex items-center gap-1">
                    <span>{f.sortOrder}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={pending || !f.isActive}
                      onClick={() => handleMove(f, 'up')}
                      title="앞으로"
                      className="h-6 w-6"
                    >
                      <ArrowUp className="h-3 w-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={pending || !f.isActive}
                      onClick={() => handleMove(f, 'down')}
                      title="뒤로"
                      className="h-6 w-6"
                    >
                      <ArrowDown className="h-3 w-3" />
                    </Button>
                  </div>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {f.viewCount.toLocaleString()}
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="inline-flex items-center gap-1 tabular-nums">
                    <ThumbsUp className="h-3 w-3 text-emerald-500" />
                    {f.helpfulYes}
                    <span className="text-slate-400">/</span>
                    <span className="text-rose-500">{f.helpfulNo}</span>
                  </div>
                </td>
                <td className="px-3 py-2 text-xs text-slate-500">
                  {formatDate(f.updatedAt)}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center justify-end gap-1">
                    <Button asChild size="sm" variant="ghost" title="편집">
                      <Link href={`/admin/faqs/${f.id}`}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                    <Button asChild size="sm" variant="ghost" title="공개 페이지">
                      <Link href={`/faq#faq-${f.id}`} target="_blank">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                    {f.isActive ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        onClick={() => handleArchive(f)}
                        title="비활성"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        onClick={() => handleRestore(f)}
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
        {items.map((f) => (
          <div
            key={f.id}
            className={`flex flex-col gap-2 rounded-md border border-slate-200 p-3 dark:border-slate-800 ${f.isActive ? '' : 'opacity-60'}`}
          >
            <div className="flex items-center gap-2">
              <Badge tone="brand" className="uppercase">
                {productLabel(f.productCode)}
              </Badge>
              {f.issueType && (
                <Badge tone="slate">{issueLabel(f.issueType)}</Badge>
              )}
              {!f.isActive && <Badge tone="danger">비활성</Badge>}
            </div>
            <Link
              href={`/admin/faqs/${f.id}`}
              className="font-semibold hover:underline"
            >
              {f.question}
            </Link>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
              <span>정렬 {f.sortOrder}</span>
              <span>조회 {f.viewCount.toLocaleString()}</span>
              <span>
                도움됨{' '}
                <span className="text-emerald-600">{f.helpfulYes}</span>/
                <span className="text-rose-500">{f.helpfulNo}</span>
              </span>
              <span>{formatDate(f.updatedAt)}</span>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <Button
                size="sm"
                variant="outline"
                disabled={pending || !f.isActive}
                onClick={() => handleMove(f, 'up')}
              >
                <ArrowUp className="h-3 w-3" />위
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={pending || !f.isActive}
                onClick={() => handleMove(f, 'down')}
              >
                <ArrowDown className="h-3 w-3" />아래
              </Button>
              <Button asChild size="sm" variant="ghost">
                <Link href={`/admin/faqs/${f.id}`}>편집</Link>
              </Button>
              {f.isActive ? (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => handleArchive(f)}
                >
                  비활성
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => handleRestore(f)}
                >
                  복구
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 페이지네이션 */}
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

function formatDate(d: Date | string | null): string {
  if (!d) return '-';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(date.getTime())) return '-';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
