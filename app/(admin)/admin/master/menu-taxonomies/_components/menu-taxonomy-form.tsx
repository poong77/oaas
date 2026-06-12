'use client';

/**
 * 메뉴 구조 편집 폼 (신규 + 수정 공용).
 *
 * - productCode: 카테고리 마스터의 product 옵션에서 선택
 * - parentId: 같은 product 내 활성 노드 (자기 자신 + 후손 제외)
 * - 깊이 검증은 서버에서 (Plan §10 Q-11, MAX_MENU_DEPTH=2)
 */

import { useActionState, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

import {
  createMenuTaxonomyAction,
  updateMenuTaxonomyAction,
  type MenuTaxonomyActionState,
} from '@/app/actions/master-menu-taxonomies-actions';
import type { MenuTaxonomy } from '@/db/schema';

export type ParentOption = {
  /** 노드 id */
  value: string;
  /** "예약 관리 > 예약 등록" 형태 */
  label: string;
  productCode: string;
  /** 0=root, 1=중분류 */
  depth: number;
};

export type ProductOption = {
  code: string;
  label: string;
};

type Props = {
  node?: MenuTaxonomy;
  productOptions: ProductOption[];
  parentOptions: ParentOption[];
  /** 수정 시 자기 자신 + 후손 ID 목록 (부모로 선택 못 하게) */
  excludeParentIds?: string[];
};

const INITIAL: MenuTaxonomyActionState = { ok: false };

export function MenuTaxonomyForm({
  node,
  productOptions,
  parentOptions,
  excludeParentIds = [],
}: Props) {
  const router = useRouter();
  const isEdit = !!node;

  const action = isEdit
    ? updateMenuTaxonomyAction.bind(null, node!.id)
    : createMenuTaxonomyAction;
  const [state, formAction, pending] = useActionState(action, INITIAL);

  const [productCode, setProductCode] = useState<string>(
    node?.productCode ?? productOptions[0]?.code ?? '',
  );

  const visibleParents = useMemo(() => {
    const excludeSet = new Set(excludeParentIds);
    return parentOptions
      .filter((p) => p.productCode === productCode)
      .filter((p) => !excludeSet.has(p.value))
      // 부모는 최대 depth 1까지만 가능 (depth 0=root, 1=중분류) → 자식은 최대 depth 2
      .filter((p) => p.depth < 2);
  }, [parentOptions, productCode, excludeParentIds]);

  if (isEdit && state.ok) {
    setTimeout(() => {
      toast.success('저장되었습니다');
      router.refresh();
    }, 0);
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="productCode">
            제품 <span className="text-red-500">*</span>
          </Label>
          <Select
            id="productCode"
            name="productCode"
            value={productCode}
            onChange={(e) => setProductCode(e.target.value)}
            disabled={pending}
            aria-invalid={!!state.fieldErrors?.productCode}
          >
            {productOptions.map((o) => (
              <option key={o.code} value={o.code}>
                {o.label} ({o.code})
              </option>
            ))}
          </Select>
          {state.fieldErrors?.productCode && (
            <p className="text-xs text-red-500">
              {state.fieldErrors.productCode}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="parentId">상위 메뉴</Label>
          <Select
            id="parentId"
            name="parentId"
            defaultValue={node?.parentId ?? ''}
            disabled={pending}
            aria-invalid={!!state.fieldErrors?.parentId}
          >
            <option value="">— 루트 (대메뉴) —</option>
            {visibleParents.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </Select>
          {state.fieldErrors?.parentId ? (
            <p className="text-xs text-red-500">{state.fieldErrors.parentId}</p>
          ) : (
            <p className="text-xs text-slate-500">
              비우면 대메뉴(루트). 최대 3단(루트/중분류/소분류).
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="label">
          라벨 <span className="text-red-500">*</span>
        </Label>
        <Input
          id="label"
          name="label"
          defaultValue={node?.label ?? ''}
          placeholder="예: 예약 관리, 예약 등록"
          required
          maxLength={60}
          disabled={pending}
          aria-invalid={!!state.fieldErrors?.label}
        />
        {state.fieldErrors?.label ? (
          <p className="text-xs text-red-500">{state.fieldErrors.label}</p>
        ) : (
          <p className="text-xs text-slate-500">
            사용자에게 노출되는 메뉴 이름. 같은 부모 아래에서는 중복 불가.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="description">설명 (운영자 메모)</Label>
        <Textarea
          id="description"
          name="description"
          defaultValue={node?.description ?? ''}
          placeholder="예: 예약 등록/단체 예약/선수금 등 예약 관련 작업"
          rows={2}
          maxLength={500}
          disabled={pending}
        />
        {state.fieldErrors?.description && (
          <p className="text-xs text-red-500">
            {state.fieldErrors.description}
          </p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="sortOrder">정렬</Label>
          <Input
            id="sortOrder"
            name="sortOrder"
            type="number"
            defaultValue={node?.sortOrder ?? 100}
            min={0}
            max={9999}
            disabled={pending}
          />
          <p className="text-xs text-slate-500">
            낮을수록 앞쪽 (기본 100). 형제 노드끼리 정렬 기준.
          </p>
        </div>
      </div>

      {state.message && !state.ok && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {state.message}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={pending}
        >
          취소
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? '저장 중…' : isEdit ? '저장' : '생성'}
        </Button>
      </div>
    </form>
  );
}
