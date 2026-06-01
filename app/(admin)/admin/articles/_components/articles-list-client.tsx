'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Pencil,
  ThumbsUp,
  Trash2,
  Undo2,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useConfirmDialog } from '@/components/dialogs/confirm-dialog';
import { formatDateKst } from '@/lib/business-hours/format';
import type { ArticleListItem } from '@/lib/services/articles';
import type { ProductCategoryView } from '@/lib/services/categories';
import { CONTENT_TYPE_META } from '@/lib/articles/content-type-meta';
import {
  archiveArticleAction,
  restoreArticleAction,
  togglePublishArticleAction,
} from '@/app/actions/article-actions';

export function ArticlesListClient({
  items,
  categories,
  total,
  page,
  pageSize,
}: {
  items: ArticleListItem[];
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
    router.push(`/admin/articles?${next.toString()}`);
  }

  async function handleTogglePublish(
    a: ArticleListItem,
    publish: boolean,
  ) {
    const ok = await confirm({
      title: publish ? '아티클을 발행하시겠습니까?' : '아티클을 발행 취소하시겠습니까?',
      description: publish
        ? `"${a.title}"이(가) 호텔리어에게 즉시 노출됩니다.`
        : `"${a.title}"이(가) 더 이상 호텔리어에게 노출되지 않습니다.`,
      confirmText: publish ? '발행' : '발행 취소',
      tone: publish ? 'default' : 'danger',
    });
    if (!ok) return;
    startTransition(async () => {
      const result = await togglePublishArticleAction(a.id, publish);
      if (result.ok) {
        toast.success(publish ? '발행되었습니다' : '발행이 취소되었습니다');
        router.refresh();
      } else {
        toast.error(result.message ?? '처리 실패');
      }
    });
  }

  async function handleArchive(a: ArticleListItem) {
    const ok = await confirm({
      title: '아티클을 비활성 처리하시겠습니까?',
      description: `"${a.title}"이(가) 호텔리어/검색에서 숨겨집니다. 데이터는 보존되며 언제든 복구할 수 있습니다.`,
      confirmText: '비활성',
      tone: 'danger',
    });
    if (!ok) return;
    startTransition(async () => {
      const result = await archiveArticleAction(a.id);
      if (result.ok) {
        toast.success('비활성 처리되었습니다');
        router.refresh();
      } else {
        toast.error(result.message ?? '처리 실패');
      }
    });
  }

  async function handleRestore(a: ArticleListItem) {
    const ok = await confirm({
      title: '복구하시겠습니까?',
      description: `"${a.title}"을(를) 다시 활성 상태로 되돌립니다.`,
      confirmText: '복구',
    });
    if (!ok) return;
    startTransition(async () => {
      const result = await restoreArticleAction(a.id);
      if (result.ok) {
        toast.success('복구되었습니다');
        router.refresh();
      } else {
        toast.error(result.message ?? '처리 실패');
      }
    });
  }

  function productLabel(code: string): string {
    return categories.find((c) => c.code === code)?.label ?? code;
  }

  return (
    <>
      {/* 데스크탑 */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900/50 dark:text-slate-400">
            <tr>
              <th className="px-3 py-2 text-left">제목 / 제품</th>
              <th className="px-3 py-2 text-left">의도</th>
              <th className="px-3 py-2 text-left">상태</th>
              <th className="px-3 py-2 text-right">조회</th>
              <th className="px-3 py-2 text-right">도움됨</th>
              <th className="px-3 py-2 text-left">마지막 수정</th>
              <th className="px-3 py-2 text-right">작업</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {items.map((a) => (
              <tr key={a.id} className={a.isActive ? '' : 'opacity-60'}>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone="brand" className="uppercase">
                      {productLabel(a.productCode)}
                    </Badge>
                    {a.categoryPath?.map((label, i) => (
                      <Badge key={`${label}-${i}`} tone="slate">
                        {label}
                      </Badge>
                    ))}
                  </div>
                  <div className="mt-1 font-medium">{a.title}</div>
                  <div className="text-xs text-slate-500">/{a.slug}</div>
                </td>
                <td className="px-3 py-2">
                  {a.contentType && CONTENT_TYPE_META[a.contentType] ? (
                    <Badge tone={CONTENT_TYPE_META[a.contentType].tone}>
                      {CONTENT_TYPE_META[a.contentType].label}
                    </Badge>
                  ) : (
                    <span className="text-xs text-slate-400">-</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap items-center gap-1">
                    {a.publishedAt ? (
                      <Badge tone="success">발행됨</Badge>
                    ) : (
                      <Badge tone="warn">Draft</Badge>
                    )}
                    {!a.isActive && <Badge tone="danger">비활성</Badge>}
                    {a.publishedAt && a.warningCount > 0 && (
                      <Link
                        href={`/admin/articles/${a.id}`}
                        title={`보완 권장 ${a.warningCount}건 — 클릭으로 편집`}
                        className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 hover:bg-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-900/40"
                      >
                        <AlertTriangle className="h-3 w-3" />
                        보완 {a.warningCount}건
                      </Link>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {a.viewCount.toLocaleString()}
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="inline-flex items-center gap-1 tabular-nums">
                    <ThumbsUp className="h-3 w-3 text-emerald-500" />
                    {a.helpfulYes}
                    <span className="text-slate-400">/</span>
                    <span className="text-rose-500">{a.helpfulNo}</span>
                  </div>
                </td>
                <td className="px-3 py-2 text-xs text-slate-500">
                  {formatDateKst(a.updatedAt)}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center justify-end gap-1">
                    <Button asChild size="sm" variant="ghost" title="편집">
                      <Link href={`/admin/articles/${a.id}`}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                    {a.publishedAt ? (
                      <Button asChild size="sm" variant="ghost" title="공개 페이지 열기">
                        <Link
                          href={`/help/${a.productCode}/${a.slug}`}
                          target="_blank"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    ) : null}
                    {a.isActive ? (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={pending}
                          onClick={() => handleTogglePublish(a, !a.publishedAt)}
                          title={a.publishedAt ? '발행 취소' : '발행'}
                        >
                          <Upload className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={pending}
                          onClick={() => handleArchive(a)}
                          title="비활성"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        onClick={() => handleRestore(a)}
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
        {items.map((a) => (
          <div
            key={a.id}
            className={`flex flex-col gap-2 rounded-md border border-slate-200 p-3 dark:border-slate-800 ${a.isActive ? '' : 'opacity-60'}`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="brand" className="uppercase">
                {productLabel(a.productCode)}
              </Badge>
              {a.categoryPath?.map((label, i) => (
                <Badge key={`${label}-${i}`} tone="slate">
                  {label}
                </Badge>
              ))}
              {a.contentType && CONTENT_TYPE_META[a.contentType] && (
                <Badge tone={CONTENT_TYPE_META[a.contentType].tone}>
                  {CONTENT_TYPE_META[a.contentType].label}
                </Badge>
              )}
              {a.publishedAt ? (
                <Badge tone="success">발행</Badge>
              ) : (
                <Badge tone="warn">Draft</Badge>
              )}
              {!a.isActive && <Badge tone="danger">비활성</Badge>}
              {a.publishedAt && a.warningCount > 0 && (
                <span
                  className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                  title={`보완 권장 ${a.warningCount}건`}
                >
                  <AlertTriangle className="h-3 w-3" />
                  보완 {a.warningCount}건
                </span>
              )}
            </div>
            <Link
              href={`/admin/articles/${a.id}`}
              className="font-semibold hover:underline"
            >
              {a.title}
            </Link>
            <div className="text-xs text-slate-500">/{a.slug}</div>
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span>조회 {a.viewCount.toLocaleString()}</span>
              <span>
                도움됨{' '}
                <span className="text-emerald-600">{a.helpfulYes}</span>/
                <span className="text-rose-500">{a.helpfulNo}</span>
              </span>
              <span>{formatDateKst(a.updatedAt)}</span>
            </div>
            <div className="flex items-center gap-1">
              {a.isActive ? (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => handleTogglePublish(a, !a.publishedAt)}
                  >
                    {a.publishedAt ? '발행취소' : '발행'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => handleArchive(a)}
                  >
                    비활성
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => handleRestore(a)}
                >
                  복구
                </Button>
              )}
              <Button asChild size="sm" variant="ghost">
                <Link href={`/admin/articles/${a.id}`}>편집</Link>
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* 페이지네이션 */}
      {lastPage > 1 && (
        <div className="flex items-center justify-between border-t border-slate-200 px-3 py-3 text-sm dark:border-slate-800">
          <div className="text-xs text-slate-500">
            {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} /{' '}
            {total}
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

