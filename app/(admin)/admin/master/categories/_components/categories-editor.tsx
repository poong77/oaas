'use client';

/**
 * 카테고리 편집 인라인 폼.
 *
 * - items가 있으면 row별 인라인 편집 (label/icon/sortOrder)
 * - createOnly=true면 신규 폼만 노출
 * - 비활성/복구 토글 버튼
 *
 * useFormState 대신 직접 onSubmit + useTransition (프로젝트 컨벤션).
 */

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { resolveIcon, KNOWN_ICON_NAMES } from '@/components/icon-resolver';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { useConfirmDialog } from '@/components/dialogs/confirm-dialog';
import { MasterIconUpload } from '../../_components/master-icon-upload';
import {
  createCategoryAction,
  updateCategoryAction,
  setCategoryActiveAction,
} from '@/app/actions/master-actions';
import type { Category, CategoryType } from '@/db/schema';

/** 부모 선택용 라벨(계층 들여쓰기). */
type ParentOption = { id: string; label: string; depth: number };

/** parent_id 기준으로 들여쓰기 라벨 목록 생성 (product 계층 표시용). */
function buildParentOptions(items: Category[]): ParentOption[] {
  const byParent = new Map<string | null, Category[]>();
  for (const it of items) {
    const key = it.parentId ?? null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(it);
  }
  const out: ParentOption[] = [];
  const walk = (parent: string | null, depth: number) => {
    const children = (byParent.get(parent) ?? []).sort(
      (a, b) => a.sortOrder - b.sortOrder,
    );
    for (const c of children) {
      out.push({ id: c.id, label: `${'  '.repeat(depth)}${c.label}`, depth });
      walk(c.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

export function CategoriesEditor({
  type,
  items,
  createOnly = false,
}: {
  type: CategoryType;
  items: Category[];
  createOnly?: boolean;
}) {
  // product 타입만 계층(부모) 지원. 부모 후보 = 전체 product 카테고리.
  const parentOptions = type === 'product' ? buildParentOptions(items) : [];

  if (createOnly) {
    return <CreateRow type={type} parentOptions={parentOptions} />;
  }

  return (
    <div className="divide-y divide-slate-100 dark:divide-slate-800">
      {items.map((it) => (
        <CategoryRow
          key={it.id}
          item={it}
          type={type}
          parentOptions={parentOptions}
        />
      ))}
    </div>
  );
}

function CategoryRow({
  item,
  type,
  parentOptions,
}: {
  item: Category;
  type: CategoryType;
  parentOptions: ParentOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const confirm = useConfirmDialog();
  const Icon = resolveIcon(item.icon);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await updateCategoryAction(item.id, undefined, fd);
      if (res.ok) {
        toast.success('저장되었습니다');
        router.refresh();
      } else {
        toast.error(res.message ?? '저장 실패');
      }
    });
  }

  async function toggleActive() {
    const target = !item.isActive;
    const ok = await confirm({
      title: target ? '항목을 복구합니다' : '항목을 비활성화합니다',
      description: target
        ? '비활성화된 항목을 다시 활성화하시겠습니까?'
        : '비활성화 시 일반 사용자에게는 보이지 않지만 기존 참조는 유지됩니다.',
      confirmText: target ? '복구' : '비활성화',
      tone: target ? 'default' : 'danger',
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await setCategoryActiveAction(item.id, target);
      if (res.ok) {
        toast.success(target ? '복구되었습니다' : '비활성화되었습니다');
        router.refresh();
      } else {
        toast.error(res.message ?? '실패');
      }
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className={`flex flex-wrap items-end gap-3 p-3 hover:bg-slate-50 dark:hover:bg-slate-900/40 ${
        item.isActive ? '' : 'opacity-60'
      }`}
    >
      <input type="hidden" name="type" value={type} />
      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-300">
        {item.iconImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.iconImageUrl} alt="" className="h-full w-full object-contain" />
        ) : (
          <Icon className="h-4 w-4" />
        )}
      </div>
      <div className="flex w-32 flex-col gap-1">
        <Label className="text-[10px]">코드</Label>
        <Input
          name="code"
          defaultValue={item.code}
          className="h-8 text-xs"
          required
        />
      </div>
      <div className="flex min-w-[160px] flex-1 flex-col gap-1">
        <Label className="text-[10px]">라벨</Label>
        <Input
          name="label"
          defaultValue={item.label}
          className="h-8 text-xs"
          required
        />
      </div>
      <div className="flex w-40 flex-col gap-1">
        <Label className="text-[10px]">아이콘 (lucide)</Label>
        <Input
          name="icon"
          defaultValue={item.icon ?? ''}
          list={`icons-${item.id}`}
          className="h-8 text-xs"
        />
        <datalist id={`icons-${item.id}`}>
          {KNOWN_ICON_NAMES.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
      </div>
      {type === 'product' && !item.parentId && (
        <MasterIconUpload defaultUrl={item.iconImageUrl} label="아이콘 이미지(대분류)" />
      )}
      <div className="flex w-20 flex-col gap-1">
        <Label className="text-[10px]">정렬</Label>
        <Input
          name="sortOrder"
          type="number"
          defaultValue={item.sortOrder}
          className="h-8 text-xs"
        />
      </div>
      {type === 'product' && (
        <>
          <div className="flex w-40 flex-col gap-1">
            <Label className="text-[10px]">상위 분류</Label>
            <Select
              name="parentId"
              defaultValue={item.parentId ?? ''}
              className="h-8 text-xs"
            >
              <option value="">— 대분류(최상위)</option>
              {parentOptions
                .filter((o) => o.id !== item.id)
                .map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
            </Select>
          </div>
          <div className="flex min-w-[140px] flex-1 flex-col gap-1">
            <Label className="text-[10px]">메모</Label>
            <Input
              name="memo"
              defaultValue={item.memo ?? ''}
              placeholder="예: 문의 디폴트값"
              className="h-8 text-xs"
            />
          </div>
        </>
      )}
      <div className="flex items-center gap-1">
        <Button type="submit" size="sm" disabled={pending}>
          저장
        </Button>
        <Button
          type="button"
          size="sm"
          variant={item.isActive ? 'ghost' : 'outline'}
          onClick={toggleActive}
          disabled={pending}
        >
          {item.isActive ? '비활성' : '복구'}
        </Button>
      </div>
    </form>
  );
}

function CreateRow({
  type,
  parentOptions,
}: {
  type: CategoryType;
  parentOptions: ParentOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    startTransition(async () => {
      const res = await createCategoryAction(undefined, fd);
      if (res.ok) {
        toast.success('추가되었습니다');
        form.reset();
        router.refresh();
      } else {
        toast.error(res.message ?? '추가 실패');
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="type" value={type} />
      <div className="flex w-32 flex-col gap-1">
        <Label className="text-[10px]">코드</Label>
        <Input
          name="code"
          placeholder="예: pms"
          className="h-8 text-xs"
          required
        />
      </div>
      <div className="flex min-w-[160px] flex-1 flex-col gap-1">
        <Label className="text-[10px]">라벨</Label>
        <Input
          name="label"
          placeholder="예: PMS"
          className="h-8 text-xs"
          required
        />
      </div>
      <div className="flex w-40 flex-col gap-1">
        <Label className="text-[10px]">아이콘 (lucide)</Label>
        <Input
          name="icon"
          placeholder="Building2"
          list="icons-create"
          className="h-8 text-xs"
        />
        <datalist id="icons-create">
          {KNOWN_ICON_NAMES.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
      </div>
      {type === 'product' && (
        <MasterIconUpload label="아이콘 이미지(대분류)" />
      )}
      <div className="flex w-20 flex-col gap-1">
        <Label className="text-[10px]">정렬</Label>
        <Input
          name="sortOrder"
          type="number"
          defaultValue={100}
          className="h-8 text-xs"
        />
      </div>
      {type === 'product' && (
        <>
          <div className="flex w-40 flex-col gap-1">
            <Label className="text-[10px]">상위 분류</Label>
            <Select name="parentId" defaultValue="" className="h-8 text-xs">
              <option value="">— 대분류(최상위)</option>
              {parentOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex min-w-[140px] flex-1 flex-col gap-1">
            <Label className="text-[10px]">메모</Label>
            <Input
              name="memo"
              placeholder="예: 문의 디폴트값"
              className="h-8 text-xs"
            />
          </div>
        </>
      )}
      <Button type="submit" size="sm" disabled={pending}>
        추가
      </Button>
    </form>
  );
}
