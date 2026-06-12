'use client';

/**
 * MenuTreeSidebar — /help/[product] 메뉴 트리 사이드바 (B1).
 *
 * - menu_taxonomies 트리 렌더링 (펼침/접힘)
 * - 노드 클릭 → ?path=A&path=B 배열 파라미터로 URL 갱신 (라벨에 '/' 포함 가능)
 * - 펼침 상태 sessionStorage 보관
 * - 각 노드별 카운트 (articleCountsByPath)
 *
 * @see docs/02-design/knowledge-base-overhaul/DESIGN.md §15-1
 */

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { MenuTaxonomyTreeNode } from '@/lib/services/master-menu-taxonomies';
import { toQueryString, pathToKey } from '@/lib/url-query';

export interface MenuTreeSidebarProps {
  productCode: string;
  tree: MenuTaxonomyTreeNode[];
  selectedPath: string[];
  articleCountsByPath: Record<string, number>;
  totalCount: number;
}

const pathKey = pathToKey;

export function MenuTreeSidebar({
  productCode,
  tree,
  selectedPath,
  articleCountsByPath,
  totalCount,
}: MenuTreeSidebarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const storageKey = `help-tree-expand-${productCode}`;

  // 펼침 상태 (sessionStorage 보관)
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.sessionStorage.getItem(storageKey);
      if (raw) setExpanded(new Set(JSON.parse(raw) as string[]));
    } catch {
      // ignore
    }
  }, [storageKey]);

  // selectedPath 진입 시 해당 ancestor 자동 펼침
  useEffect(() => {
    if (selectedPath.length === 0) return;
    setExpanded((prev) => {
      const next = new Set(prev);
      for (let i = 1; i <= selectedPath.length; i++) {
        next.add(pathKey(selectedPath.slice(0, i)));
      }
      return next;
    });
  }, [selectedPath.join('/')]);

  function persistExpanded(next: Set<string>) {
    if (typeof window === 'undefined') return;
    try {
      window.sessionStorage.setItem(storageKey, JSON.stringify([...next]));
    } catch {
      // ignore
    }
  }

  function toggleExpand(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      persistExpanded(next);
      return next;
    });
  }

  function navigateTo(nextPath: string[]) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('path');
    for (const part of nextPath) params.append('path', part);
    // 카테고리 브라우징은 키워드 검색과 별개 모드 — 클릭 시 이전 검색어/페이지 초기화.
    // (q가 남아 있으면 path AND q 조합으로 0건이 나오는 혼란 방지)
    params.delete('q');
    params.delete('page');
    router.push(`/help/${productCode}?${toQueryString(params)}`);
  }

  const selectedKey = pathKey(selectedPath);

  return (
    <aside className="flex flex-col gap-2">
      <div className="rounded-md border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">
            카테고리
          </h3>
          <button
            type="button"
            onClick={() => navigateTo([])}
            className={`text-xs ${
              selectedPath.length === 0
                ? 'font-semibold text-brand-600 dark:text-brand-300'
                : 'text-slate-500 hover:text-brand-600'
            }`}
          >
            전체 ({totalCount})
          </button>
        </div>
        {tree.length === 0 ? (
          <p className="text-xs text-slate-400">메뉴 마스터가 비어 있습니다.</p>
        ) : (
          <TreeList
            nodes={tree}
            depth={0}
            parentPath={[]}
            expanded={expanded}
            selectedKey={selectedKey}
            counts={articleCountsByPath}
            onToggle={toggleExpand}
            onSelect={navigateTo}
          />
        )}
      </div>
    </aside>
  );
}

function TreeList({
  nodes,
  depth,
  parentPath,
  expanded,
  selectedKey,
  counts,
  onToggle,
  onSelect,
}: {
  nodes: MenuTaxonomyTreeNode[];
  depth: number;
  parentPath: string[];
  expanded: Set<string>;
  selectedKey: string;
  counts: Record<string, number>;
  onToggle: (key: string) => void;
  onSelect: (nextPath: string[]) => void;
}) {
  return (
    <ul className={`flex flex-col gap-0.5 ${depth > 0 ? 'pl-3' : ''}`}>
      {nodes.map((n) => {
        const myPath = [...parentPath, n.label];
        const key = pathKey(myPath);
        const count = counts[key] ?? 0;
        const isOpen = expanded.has(key);
        const isSelected = selectedKey === key;
        const hasChildren = n.children.length > 0;

        return (
          <li
            key={n.id}
            data-testid={depth === 0 ? 'menu-tree-node-l1' : `menu-tree-node-l${depth + 1}`}
          >
            <div
              className={`flex items-center justify-between rounded px-1.5 py-1 ${
                isSelected
                  ? 'border-l-2 border-brand-500 bg-brand-50 dark:bg-brand-950/40'
                  : 'hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <button
                type="button"
                onClick={() => onSelect(myPath)}
                className={`flex min-w-0 flex-1 items-center gap-1 text-left text-xs ${
                  isSelected
                    ? 'font-semibold text-brand-700 dark:text-brand-300'
                    : 'text-slate-700 dark:text-slate-200'
                }`}
              >
                {hasChildren ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggle(key);
                    }}
                    aria-label={isOpen ? '접기' : '펼치기'}
                    className="inline-flex h-4 w-4 items-center justify-center text-slate-400 hover:text-slate-700"
                  >
                    {isOpen ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                  </button>
                ) : (
                  <span className="inline-block h-4 w-4" />
                )}
                <span className="min-w-0 flex-1 truncate" title={n.label}>
                  {n.label}
                </span>
              </button>
              <span className="ml-1 text-[10px] text-slate-400 tabular-nums">
                {count > 0 ? count : ''}
              </span>
            </div>
            {hasChildren && isOpen && (
              <TreeList
                nodes={n.children}
                depth={depth + 1}
                parentPath={myPath}
                expanded={expanded}
                selectedKey={selectedKey}
                counts={counts}
                onToggle={onToggle}
                onSelect={onSelect}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}
