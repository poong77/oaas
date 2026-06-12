'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Pencil,
  Pin,
  Trash2,
  Undo2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageSizeSelect } from '@/components/admin/page-size-select';
import { useConfirmDialog } from '@/components/dialogs/confirm-dialog';
import { formatDateKst } from '@/lib/business-hours/format';
import type { NoticeListItem } from '@/lib/services/notices';
import type { ProductCategoryView } from '@/lib/services/categories';
import {
  NOTICE_KIND_CLASSES,
  NOTICE_KIND_META,
} from '@/lib/services/notices-meta';
import {
  archiveNoticeAction,
  restoreNoticeAction,
  togglePublishNoticeAction,
} from '@/app/actions/notice-actions';

export function NoticesListClient({
  items,
  categories,
  total,
  page,
  pageSize,
}: {
  items: NoticeListItem[];
  categories: ProductCategoryView[];
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
    router.push(`/admin/notices?${next.toString()}`);
  }

  async function handleTogglePublish(n: NoticeListItem, publish: boolean) {
    const ok = await confirm({
      title: publish ? '공지를 발행하시겠습니까?' : '발행을 취소하시겠습니까?',
      description: publish
        ? `"${n.title}"이(가) 호텔리어에게 즉시 노출됩니다.`
        : `"${n.title}"이(가) 더 이상 호텔리어에게 노출되지 않습니다.`,
      confirmText: publish ? '발행' : '발행 취소',
      tone: publish ? 'default' : 'danger',
    });
    if (!ok) return;
    startTransition(async () => {
      const result = await togglePublishNoticeAction(n.id, publish);
      if (result.ok) {
        toast.success(publish ? '발행되었습니다' : '발행이 취소되었습니다');
        router.refresh();
      } else {
        toast.error(result.message ?? '처리 실패');
      }
    });
  }

  async function handleArchive(n: NoticeListItem) {
    const ok = await confirm({
      title: '공지를 비활성 처리하시겠습니까?',
      description: `"${n.title}"이(가) 호텔리어/검색에서 숨겨집니다. 데이터는 보존되며 언제든 복구할 수 있습니다.`,
      confirmText: '비활성',
      tone: 'danger',
    });
    if (!ok) return;
    startTransition(async () => {
      const result = await archiveNoticeAction(n.id);
      if (result.ok) {
        toast.success('비활성 처리되었습니다');
        router.refresh();
      } else {
        toast.error(result.message ?? '처리 실패');
      }
    });
  }

  async function handleRestore(n: NoticeListItem) {
    const ok = await confirm({
      title: '복구하시겠습니까?',
      description: `"${n.title}"을(를) 다시 활성 상태로 되돌립니다.`,
      confirmText: '복구',
    });
    if (!ok) return;
    startTransition(async () => {
      const result = await restoreNoticeAction(n.id);
      if (result.ok) {
        toast.success('복구되었습니다');
        router.refresh();
      } else {
        toast.error(result.message ?? '처리 실패');
      }
    });
  }

  function productLabel(code: string | null): string {
    if (!code) return '전체';
    return categories.find((c) => c.code === code)?.label ?? code;
  }

  return (
    <>
      {/* 데스크탑 */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900/50 dark:text-slate-400">
            <tr>
              <th className="px-3 py-2 text-left">종류 / 제목</th>
              <th className="px-3 py-2 text-left">제품</th>
              <th className="px-3 py-2 text-left">상태</th>
              <th className="px-3 py-2 text-left">발행일자</th>
              <th className="px-3 py-2 text-right">조회</th>
              <th className="px-3 py-2 text-left">마지막 수정</th>
              <th className="px-3 py-2 text-right">작업</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {items.map((n) => {
              const meta = NOTICE_KIND_META[n.kind];
              const kindClass = NOTICE_KIND_CLASSES[n.kind];
              return (
                <tr key={n.id} className={n.isActive ? '' : 'opacity-60'}>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${kindClass}`}
                      >
                        {meta.label}
                      </span>
                      {n.pinned && (
                        <span
                          className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                          title="상단 고정"
                        >
                          <Pin className="h-2.5 w-2.5" />
                          고정
                        </span>
                      )}
                    </div>
                    <div className="mt-1 font-medium">{n.title}</div>
                  </td>
                  <td className="px-3 py-2 text-sm">
                    {productLabel(n.productCode)}
                  </td>
                  <td className="px-3 py-2">
                    {n.publishedAt ? (
                      <Badge tone="success">발행됨</Badge>
                    ) : (
                      <Badge tone="warn">Draft</Badge>
                    )}
                    {n.banner && (
                      <Badge tone="danger" className="ml-1">
                        배너
                      </Badge>
                    )}
                    {!n.isActive && (
                      <Badge tone="danger" className="ml-1">
                        비활성
                      </Badge>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs tabular-nums">
                    {n.publishedAt ? (
                      <span className="text-slate-700 dark:text-slate-300">
                        {formatDateKst(n.publishedAt)}
                      </span>
                    ) : (
                      <span className="text-slate-400 dark:text-slate-500">미발행</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {n.viewCount.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                    {formatDateKst(n.updatedAt)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1">
                      <Button asChild size="sm" variant="ghost" title="편집">
                        <Link href={`/admin/notices/${n.id}`}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                      {n.publishedAt && n.isActive ? (
                        <Button
                          asChild
                          size="sm"
                          variant="ghost"
                          title="공개 페이지 열기"
                        >
                          <Link href={`/notices/${n.id}`} target="_blank">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      ) : null}
                      {n.isActive ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={pending}
                          onClick={() => handleArchive(n)}
                          title="비활성"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={pending}
                          onClick={() => handleRestore(n)}
                          title="복구"
                        >
                          <Undo2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 모바일 카드뷰 */}
      <div className="flex flex-col gap-2 p-3 md:hidden">
        {items.map((n) => {
          const meta = NOTICE_KIND_META[n.kind];
          const kindClass = NOTICE_KIND_CLASSES[n.kind];
          return (
            <div
              key={n.id}
              className={`flex flex-col gap-2 rounded-md border border-slate-200 p-3 dark:border-slate-800 ${
                n.isActive ? '' : 'opacity-60'
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${kindClass}`}
                >
                  {meta.label}
                </span>
                {n.pinned && (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                    <Pin className="h-2.5 w-2.5" />
                    고정
                  </span>
                )}
                {n.publishedAt ? (
                  <Badge tone="success">발행</Badge>
                ) : (
                  <Badge tone="warn">Draft</Badge>
                )}
                {n.banner && <Badge tone="danger">배너</Badge>}
                {!n.isActive && <Badge tone="danger">비활성</Badge>}
              </div>
              <Link
                href={`/admin/notices/${n.id}`}
                className="font-semibold hover:underline"
              >
                {n.title}
              </Link>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {productLabel(n.productCode)} · 발행{' '}
                {n.publishedAt ? formatDateKst(n.publishedAt) : '미발행'} · 조회{' '}
                {n.viewCount.toLocaleString()} · 수정 {formatDateKst(n.updatedAt)}
              </div>
              <div className="flex items-center gap-1">
                {n.isActive ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() => handleTogglePublish(n, !n.publishedAt)}
                    >
                      {n.publishedAt ? '발행취소' : '발행'}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => handleArchive(n)}
                    >
                      비활성
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => handleRestore(n)}
                  >
                    복구
                  </Button>
                )}
                <Button asChild size="sm" variant="ghost">
                  <Link href={`/admin/notices/${n.id}`}>편집</Link>
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* 페이지네이션 */}
      <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 px-3 py-3 text-sm dark:border-slate-800 sm:flex-row">
        <div className="flex items-center gap-3">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {total === 0 ? 0 : (page - 1) * pageSize + 1}-
            {Math.min(page * pageSize, total)} / {total}
          </div>
          <PageSizeSelect pageSize={pageSize} />
        </div>
        {lastPage > 1 && (
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
        )}
      </div>
    </>
  );
}

