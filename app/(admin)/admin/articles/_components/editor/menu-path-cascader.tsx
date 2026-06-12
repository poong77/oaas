'use client';

/**
 * MenuPathCascader — categoryPath 3단 캐스케이딩 드롭다운 (A2).
 *
 * 흐름:
 *   - productCode 변경 시 useEffect로 트리 fetch
 *   - 1단계 선택 → 2단계 드롭다운 활성화 → 3단계 …
 *   - 수동 입력 토글: 마스터에 없는 경로 호환 (admin만)
 *
 * @see docs/02-design/knowledge-base-overhaul/DESIGN.md §1-1
 */

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { MenuTaxonomyTreeNode } from '@/lib/services/master-menu-taxonomies';
import { getMenuTaxonomyTreeAction } from '@/app/actions/article-actions';

export interface MenuPathCascaderProps {
  productCode: string;
  value: string[];
  onChange: (path: string[]) => void;
  allowManual?: boolean;
}

export function MenuPathCascader({
  productCode,
  value,
  onChange,
  allowManual = true,
}: MenuPathCascaderProps) {
  const [tree, setTree] = useState<MenuTaxonomyTreeNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [manual, setManual] = useState(false);
  const [manualText, setManualText] = useState(value.join(' > '));

  useEffect(() => {
    if (!productCode) return;
    let cancelled = false;
    setLoading(true);
    getMenuTaxonomyTreeAction(productCode)
      .then((nodes) => {
        if (!cancelled) setTree(nodes);
      })
      .catch(() => {
        if (!cancelled) setTree([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [productCode]);

  // 현재 path 각 단계에 해당하는 노드 (null이면 미선택)
  const selectedNodes = useMemo(() => {
    const result: Array<MenuTaxonomyTreeNode | null> = [];
    let cursor = tree;
    for (const label of value) {
      const found = cursor.find((n) => n.label === label) ?? null;
      result.push(found);
      cursor = found?.children ?? [];
    }
    return result;
  }, [tree, value]);

  // path 가운데 마스터에 없는 라벨이 하나라도 있으면 경고
  const hasUnknownLabel =
    value.length > 0 && selectedNodes.some((n) => n === null);

  // 각 단계별 노드 옵션
  const optionsAtDepth = (depth: number): MenuTaxonomyTreeNode[] => {
    if (depth === 0) return tree;
    const parent = selectedNodes[depth - 1];
    return parent?.children ?? [];
  };

  function handleSelect(depth: number, label: string) {
    const next = [...value.slice(0, depth)];
    if (label) next.push(label);
    onChange(next);
  }

  function commitManual() {
    const parts = manualText
      .split('>')
      .map((s) => s.trim())
      .filter(Boolean);
    onChange(parts);
    setManual(false);
  }

  if (manual && allowManual) {
    return (
      <div className="flex flex-col gap-1.5">
        <Label>메뉴 경로 (수동 입력)</Label>
        <div className="flex gap-2">
          <Input
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
            placeholder="예: 예약 관리 > 예약 등록"
          />
          <Button type="button" size="sm" onClick={commitManual}>
            확인
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setManual(false)}
          >
            취소
          </Button>
        </div>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {'>'} 로 구분. 마스터 정본과 매칭되지 않으면 사이드바 트리에서 누락될 수 있어요.
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label>메뉴 경로 (menu_path)</Label>
      <div className="grid gap-2 sm:grid-cols-3">
        {[0, 1, 2].map((depth) => {
          const options = optionsAtDepth(depth);
          const current = value[depth] ?? '';
          const disabled = depth > 0 && !selectedNodes[depth - 1];
          return (
            <Select
              key={depth}
              value={current}
              onChange={(e) => handleSelect(depth, e.target.value)}
              disabled={disabled || loading || options.length === 0}
            >
              <option value="">
                {depth === 0
                  ? loading
                    ? '로딩 중...'
                    : tree.length === 0
                      ? '메뉴 마스터 비어 있음'
                      : '1단계 선택'
                  : disabled
                    ? `${depth + 1}단계 선택`
                    : options.length === 0
                      ? '하위 메뉴 없음'
                      : `${depth + 1}단계 선택`}
              </option>
              {options.map((n) => (
                <option key={n.id} value={n.label}>
                  {n.label}
                </option>
              ))}
            </Select>
          );
        })}
      </div>
      {hasUnknownLabel && (
        <div className="flex items-start gap-1.5 rounded border border-amber-300 bg-amber-50 px-2 py-1.5 text-xs text-amber-700 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          <span>
            현재 경로에 마스터에 없는 항목이 있어요. 새 메뉴를 추가하거나 매핑을 다시 선택해주세요.
          </span>
        </div>
      )}
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {value.length > 0 ? value.join(' > ') : '경로 미선택'}
        </span>
        {allowManual && (
          <button
            type="button"
            onClick={() => {
              setManualText(value.join(' > '));
              setManual(true);
            }}
            className="text-xs text-brand-600 hover:underline dark:text-brand-300"
          >
            수동 입력
          </button>
        )}
      </div>
    </div>
  );
}
