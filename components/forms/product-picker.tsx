'use client';

/**
 * 제품 분류 선택기 (대/중/소 계층).
 *
 * - mode='root-only' : 대분류만 단일 Select (호텔리어 접수폼).
 * - mode='cascade'   : 대 → 중 → 소 단계별 Select (매니저·어드민 접수폼).
 *
 * 외부는 단일 productCode 문자열(value)만 관리한다. 현재 value의 경로(대/중/소)는
 * 트리에서 역산해 각 Select에 반영하므로, AI 분류·prefill이 깊은 코드를 넣어도 자동 정합.
 * root-only에서 깊은 코드가 들어오면 해당 대분류로 정규화(useEffect)한다.
 */

import { useEffect, useMemo } from 'react';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { ProductTaxonomyNode } from '@/lib/services/master-categories';

export type ProductPickerMode = 'root-only' | 'cascade';

type Opt = { code: string; label: string };

type Flat = {
  roots: Opt[];
  childrenOf: Map<string, Opt[]>;
  pathOf: Map<string, string[]>;
};

function flatten(tree: ProductTaxonomyNode[]): Flat {
  const roots: Opt[] = tree.map((r) => ({ code: r.code, label: r.label }));
  const childrenOf = new Map<string, Opt[]>();
  const pathOf = new Map<string, string[]>();
  const walk = (node: ProductTaxonomyNode, ancestors: string[]) => {
    const path = [...ancestors, node.code];
    pathOf.set(node.code, path);
    if (node.children.length > 0) {
      childrenOf.set(
        node.code,
        node.children.map((c) => ({ code: c.code, label: c.label })),
      );
    }
    for (const c of node.children) walk(c, path);
  };
  for (const r of tree) walk(r, []);
  return { roots, childrenOf, pathOf };
}

export function ProductPicker({
  tree,
  value,
  onChange,
  disabled,
  mode,
  includeUndefined = true,
  undefinedLabel,
  className,
}: {
  tree: ProductTaxonomyNode[];
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
  mode: ProductPickerMode;
  /** 비어있음(미선택) 옵션 노출 여부. */
  includeUndefined?: boolean;
  /** 미선택/대분류 placeholder 라벨. */
  undefinedLabel?: string;
  className?: string;
}) {
  const { roots, childrenOf, pathOf } = useMemo(() => flatten(tree), [tree]);

  const path = (value && pathOf.get(value)) || [];
  const rootCode = path[0] ?? '';
  const midCode = path[1] ?? '';
  const leafCode = path[2] ?? '';

  // root-only 모드에서 깊은 코드(중/소)가 들어오면 대분류로 정규화
  useEffect(() => {
    if (mode === 'root-only' && value && rootCode && value !== rootCode) {
      onChange(rootCode);
    }
  }, [mode, value, rootCode, onChange]);

  const midOptions = rootCode ? (childrenOf.get(rootCode) ?? []) : [];
  const leafOptions = midCode ? (childrenOf.get(midCode) ?? []) : [];

  if (mode === 'root-only') {
    return (
      <Select
        value={rootCode}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={className}
      >
        {includeUndefined && (
          <option value="">{undefinedLabel ?? '선택'}</option>
        )}
        {roots.map((r) => (
          <option key={r.code} value={r.code}>
            {r.label}
          </option>
        ))}
      </Select>
    );
  }

  // cascade: 대 → 중 → 소. 하위가 있을 때만 다음 단계 노출.
  return (
    <div className={cn('flex flex-col gap-2 sm:flex-row sm:items-center', className)}>
      <Select
        value={rootCode}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="flex-1"
      >
        {includeUndefined && (
          <option value="">{undefinedLabel ?? '대분류'}</option>
        )}
        {roots.map((r) => (
          <option key={r.code} value={r.code}>
            {r.label}
          </option>
        ))}
      </Select>

      {midOptions.length > 0 && (
        <Select
          value={midCode}
          onChange={(e) => onChange(e.target.value || rootCode)}
          disabled={disabled}
          className="flex-1"
        >
          <option value="">중분류 (선택)</option>
          {midOptions.map((o) => (
            <option key={o.code} value={o.code}>
              {o.label}
            </option>
          ))}
        </Select>
      )}

      {midCode && leafOptions.length > 0 && (
        <Select
          value={leafCode}
          onChange={(e) => onChange(e.target.value || midCode)}
          disabled={disabled}
          className="flex-1"
        >
          <option value="">소분류 (선택)</option>
          {leafOptions.map((o) => (
            <option key={o.code} value={o.code}>
              {o.label}
            </option>
          ))}
        </Select>
      )}
    </div>
  );
}
