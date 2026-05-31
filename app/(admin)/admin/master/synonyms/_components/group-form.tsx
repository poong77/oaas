'use client';

/**
 * 동의어 그룹 마스터 편집 폼 (신규 + 수정 공용).
 * Design §6.4.
 */

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  createTermGroupAction,
  updateTermGroupAction,
  type GroupActionState,
} from '@/app/actions/master-synonyms-actions';
import type { TermGroup } from '@/db/schema';

const CATEGORY_OPTIONS = [
  { value: 'operation', label: '운영' },
  { value: 'housekeeping', label: '청소' },
  { value: 'fnb', label: 'F&B' },
  { value: 'frontdesk', label: '프런트' },
  { value: 'pms', label: 'PMS' },
  { value: 'product', label: '제품' },
  { value: 'issue', label: '장애' },
  { value: 'role', label: '직무' },
  { value: 'misc', label: '기타' },
];

type SuggestedCategoryOption = {
  value: string; // categories.id
  label: string; // "issue_type / 오류"
};

type Props = {
  group?: TermGroup;
  suggestedCategoryOptions: SuggestedCategoryOption[];
  /** 신규 생성 시 대표어 프리필 (아티클 갭 탐지 "그룹 생성" 진입). */
  defaultCanonical?: string;
};

const INITIAL: GroupActionState = { ok: false };

export function GroupForm({
  group,
  suggestedCategoryOptions,
  defaultCanonical,
}: Props) {
  const router = useRouter();
  const isEdit = !!group;

  const action = isEdit
    ? updateTermGroupAction.bind(null, group!.id)
    : createTermGroupAction;
  const [state, formAction, pending] = useActionState(action, INITIAL);

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
          <Label htmlFor="canonicalTerm">
            대표어 <span className="text-red-500">*</span>
          </Label>
          <Input
            id="canonicalTerm"
            name="canonicalTerm"
            defaultValue={group?.canonicalTerm ?? defaultCanonical ?? ''}
            placeholder="체크인"
            required
            maxLength={60}
            disabled={pending}
            aria-invalid={!!state.fieldErrors?.canonicalTerm}
          />
          {state.fieldErrors?.canonicalTerm ? (
            <p className="text-xs text-red-500">
              {state.fieldErrors.canonicalTerm}
            </p>
          ) : (
            <p className="text-xs text-slate-500">
              사용자에게 노출되는 표준 표현. 그룹마다 1개.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="category">
            분류 <span className="text-red-500">*</span>
          </Label>
          <Select
            id="category"
            name="category"
            defaultValue={group?.category ?? 'misc'}
            disabled={pending}
            aria-invalid={!!state.fieldErrors?.category}
          >
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
          {state.fieldErrors?.category && (
            <p className="text-xs text-red-500">{state.fieldErrors.category}</p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="suggestedCategoryId">
          추천 카테고리 (티켓 자동 매칭 시 사용)
        </Label>
        <Select
          id="suggestedCategoryId"
          name="suggestedCategoryId"
          defaultValue={group?.suggestedCategoryId ?? ''}
          disabled={pending}
        >
          <option value="">— 사용 안 함 —</option>
          {suggestedCategoryOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <p className="text-xs text-slate-500">
          본 그룹의 동의어가 본문에 매칭되면 이 카테고리를 추천합니다 (P1
          기능).
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="description">설명 (운영자 메모)</Label>
        <Textarea
          id="description"
          name="description"
          defaultValue={group?.description ?? ''}
          placeholder="예: 모바일 키 발급 관련 문의 자동 라우팅..."
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
            defaultValue={group?.sortOrder ?? 100}
            min={0}
            max={9999}
            disabled={pending}
          />
          <p className="text-xs text-slate-500">
            낮을수록 앞쪽 (기본 100).
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
