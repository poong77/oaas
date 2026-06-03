'use client';

/**
 * CB-05 — 지식팩 내보내기 컨트롤 (제품 필터 + 다운로드 버튼).
 *
 * 제품 선택은 ?product= 쿼리로 페이지를 갱신(서버에서 통계·미리보기 재생성).
 * 다운로드는 현재 선택된 제품 범위로 API 호출.
 */

import { useRouter, useSearchParams } from 'next/navigation';
import { Download, FileJson, FileText } from 'lucide-react';

import { Button } from '@/components/ui/button';

type ProductOption = { code: string; label: string };

export function ExportControls({
  products,
  selected,
}: {
  products: ProductOption[];
  selected: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function onProductChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'all') params.delete('product');
    else params.set('product', value);
    const qs = params.toString();
    router.push(qs ? `?${qs}` : '?');
  }

  const productParam =
    selected === 'all' ? '' : `&product=${encodeURIComponent(selected)}`;

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
          제품 범위
        </span>
        <select
          value={selected}
          onChange={(e) => onProductChange(e.target.value)}
          className="focus:border-brand-400 focus:ring-brand-200 dark:focus:ring-brand-900 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:ring-2 focus:outline-none sm:w-56 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        >
          <option value="all">전체 제품</option>
          {products.map((p) => (
            <option key={p.code} value={p.code}>
              {p.label}
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline">
          <a
            href={`/api/admin/knowledge-export?format=md${productParam}`}
            download
          >
            <FileText className="mr-1.5 h-4 w-4" />
            Markdown 다운로드
          </a>
        </Button>
        <Button asChild>
          <a
            href={`/api/admin/knowledge-export?format=jsonl${productParam}`}
            download
          >
            <FileJson className="mr-1.5 h-4 w-4" />
            JSONL 다운로드
          </a>
        </Button>
        <Button
          asChild
          variant="ghost"
          size="icon"
          title="Markdown 새 탭에서 미리보기"
        >
          <a
            href={`/api/admin/knowledge-export?format=md${productParam}`}
            target="_blank"
            rel="noreferrer"
          >
            <Download className="h-4 w-4" />
          </a>
        </Button>
      </div>
    </div>
  );
}
