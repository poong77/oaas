'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition, type FormEvent } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import type { ProductCategoryView } from '@/lib/services/categories';

/** 메뉴구분(중분류>소분류) 드롭다운 옵션 — 서버에서 평탄화해 전달. */
export type MenuFilterOption = {
  /** pathLabels를 '|'로 join한 값 (selectedPath 직렬화). */
  value: string;
  /** 표시용 ' › ' join 라벨. */
  label: string;
  /** 0=중분류, 1=소분류. 들여쓰기용. */
  depth: number;
};

export function ArticlesFilters({
  initial,
  categories,
  menuOptions,
}: {
  initial: {
    q?: string;
    productCode?: string;
    menuPath?: string;
    status?: string;
    active?: string;
    sortBy?: string;
    sortOrder?: string;
  };
  categories: ProductCategoryView[];
  menuOptions: MenuFilterOption[];
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [q, setQ] = useState(initial.q ?? '');
  const [pending, startTransition] = useTransition();

  function applyFilters(updates: Record<string, string | undefined>) {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v === undefined || v === '') next.delete(k);
      else next.set(k, v);
    }
    next.delete('page');
    startTransition(() =>
      router.push(`/admin/articles?${next.toString()}`),
    );
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    applyFilters({ q });
  }

  const productSelected = Boolean(initial.productCode);

  return (
    <div className="grid gap-3 rounded-md border border-slate-200 bg-slate-50/40 p-3 dark:border-slate-800 dark:bg-slate-900/30 sm:grid-cols-2 lg:grid-cols-6">
      <form onSubmit={onSubmit} className="relative lg:col-span-2">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="제목/요약/본문/동의어 검색"
          className="pl-8 pr-8"
        />
        {q && (
          <button
            type="button"
            onClick={() => {
              setQ('');
              applyFilters({ q: undefined });
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
            aria-label="검색어 지우기"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </form>

      <Select
        value={initial.productCode ?? ''}
        onChange={(e) =>
          // 제품 변경 시 메뉴구분 선택 초기화 (메뉴 트리가 제품 종속).
          applyFilters({
            productCode: e.target.value || undefined,
            menuPath: undefined,
          })
        }
        aria-label="제품 필터"
      >
        <option value="">모든 제품</option>
        {categories.map((c) => (
          <option key={c.id} value={c.code}>
            {c.label}
          </option>
        ))}
      </Select>

      <Select
        value={initial.menuPath ?? ''}
        onChange={(e) =>
          applyFilters({ menuPath: e.target.value || undefined })
        }
        aria-label="메뉴구분 필터"
        disabled={!productSelected || menuOptions.length === 0}
        title={
          !productSelected
            ? '제품을 먼저 선택하세요'
            : menuOptions.length === 0
              ? '이 제품에 등록된 메뉴구분이 없습니다'
              : undefined
        }
      >
        <option value="">
          {!productSelected
            ? '제품 선택 후 메뉴구분'
            : menuOptions.length === 0
              ? '메뉴구분 없음'
              : '모든 메뉴구분'}
        </option>
        {menuOptions.map((m) => (
          <option key={m.value} value={m.value}>
            {m.depth > 0 ? `${'  '.repeat(m.depth)}└ ` : ''}
            {m.label}
          </option>
        ))}
      </Select>

      <Select
        value={initial.status ?? 'all'}
        onChange={(e) => applyFilters({ status: e.target.value })}
        aria-label="발행 상태"
      >
        <option value="all">발행/Draft 모두</option>
        <option value="published">발행만</option>
        <option value="draft">Draft만</option>
      </Select>

      <Select
        value={`${initial.sortBy ?? 'updated_at'}:${initial.sortOrder ?? 'desc'}`}
        onChange={(e) => {
          const [sortBy, sortOrder] = e.target.value.split(':');
          applyFilters({ sortBy, sortOrder });
        }}
        aria-label="정렬"
      >
        <option value="updated_at:desc">최근 수정순</option>
        <option value="published_at:desc">최근 발행순</option>
        <option value="view_count:desc">조회수 많은순</option>
        <option value="helpful:desc">도움됨 많은순</option>
      </Select>

      <Select
        value={initial.active ?? 'active'}
        onChange={(e) => applyFilters({ active: e.target.value })}
        aria-label="활성 상태"
        className="sm:col-span-2 lg:col-span-6"
      >
        <option value="active">활성만</option>
        <option value="inactive">비활성만</option>
        <option value="all">전체</option>
      </Select>

      <p className="text-xs text-slate-500 dark:text-slate-400 sm:col-span-2 lg:col-span-6">
        검색은 제목·요약·본문과 <strong>동의어(keywords)</strong>를 함께 매칭하며,
        동의어 사전으로 자동 확장됩니다 (예: 실시간객실 ↔ 실시간 객실).
      </p>

      {pending && (
        <span className="text-xs text-slate-500 dark:text-slate-400 sm:col-span-2 lg:col-span-6">
          적용 중...
        </span>
      )}
    </div>
  );
}
