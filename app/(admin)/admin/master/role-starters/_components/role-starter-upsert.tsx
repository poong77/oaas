'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useConfirmDialog } from '@/components/dialogs/confirm-dialog';
import { KNOWN_ICON_NAMES } from '@/components/icon-resolver';
import { MasterIconUpload } from '../../_components/master-icon-upload';
import {
  upsertRoleStarterAction,
  setRoleStarterActiveAction,
} from '@/app/actions/master-actions';
import { searchArticlesForAutocompleteAction } from '@/app/actions/article-actions';
import { searchFaqsForAutocompleteAction } from '@/app/actions/faq-actions';
import { KNOWN_ROLE_KEYS } from '@/lib/services/master-meta';
import type { RoleStarter } from '@/db/schema';
import {
  RoleStarterMapper,
  type MappedEntity,
} from './role-starter-mapper';

/** 아티클 자동완성 → 매퍼 표시 모델. */
async function searchArticles(q: string): Promise<MappedEntity[]> {
  const rows = await searchArticlesForAutocompleteAction(q);
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    meta: `${r.productCode} · /${r.slug}`,
  }));
}

/** FAQ 자동완성 → 매퍼 표시 모델. */
async function searchFaqs(q: string): Promise<MappedEntity[]> {
  const rows = await searchFaqsForAutocompleteAction(q);
  return rows.map((r) => ({
    id: r.id,
    title: r.question,
    meta: `${r.productCode}${r.issueType ? ` · ${r.issueType}` : ''}`,
  }));
}

export function RoleStarterUpsert({
  item,
  initialArticles = [],
  initialFaqs = [],
}: {
  item?: RoleStarter;
  initialArticles?: MappedEntity[];
  initialFaqs?: MappedEntity[];
}) {
  const router = useRouter();
  const confirm = useConfirmDialog();
  const [pending, startTransition] = useTransition();
  const isEdit = !!item;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    startTransition(async () => {
      const res = await upsertRoleStarterAction(undefined, fd);
      if (res.ok) {
        toast.success('저장되었습니다');
        if (!isEdit) form.reset();
        router.refresh();
      } else {
        toast.error(res.message ?? '저장 실패');
      }
    });
  }

  async function toggleActive() {
    if (!item) return;
    const target = !item.isActive;
    const ok = await confirm({
      title: target ? '항목을 복구합니다' : '항목을 비활성화합니다',
      confirmText: target ? '복구' : '비활성화',
      tone: target ? 'default' : 'danger',
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await setRoleStarterActiveAction(item.id, target);
      if (res.ok) {
        toast.success(target ? '복구되었습니다' : '비활성화되었습니다');
        router.refresh();
      } else {
        toast.error(res.message ?? '실패');
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label>역할 키</Label>
          <Input
            name="roleKey"
            defaultValue={item?.roleKey ?? ''}
            list="role-keys"
            required
            // 편집 시 변경 불가 — 단, disabled면 FormData에 미전송되어 저장 실패하므로 readOnly 사용
            readOnly={isEdit}
            className={`font-mono text-xs ${isEdit ? 'cursor-not-allowed bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' : ''}`}
            placeholder="front"
          />
          <datalist id="role-keys">
            {KNOWN_ROLE_KEYS.map((k) => (
              <option key={k} value={k} />
            ))}
          </datalist>
        </div>
        <div className="flex flex-col gap-1">
          <Label>라벨</Label>
          <Input
            name="label"
            defaultValue={item?.label ?? ''}
            required
            placeholder="프론트"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <Label>설명</Label>
        <Input
          name="description"
          defaultValue={item?.description ?? ''}
          placeholder="체크인·체크아웃·키 발급 등 프론트 데스크 업무 가이드"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label>아이콘 (lucide)</Label>
          <Input
            name="icon"
            defaultValue={item?.icon ?? ''}
            list="rs-icons"
            placeholder="BellRing"
          />
          <datalist id="rs-icons">
            {KNOWN_ICON_NAMES.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </div>
        <div className="flex flex-col gap-1">
          <Label>정렬</Label>
          <Input
            name="sortOrder"
            type="number"
            defaultValue={item?.sortOrder ?? 100}
          />
        </div>
      </div>

      <MasterIconUpload defaultUrl={item?.iconImageUrl ?? null} />


      {/* D3 — 매핑 (편집 모드에서만; 신규는 먼저 업서트 후 편집으로) */}
      {isEdit && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5 rounded-md border border-slate-200 bg-slate-50/40 p-3 dark:border-slate-800 dark:bg-slate-900/30">
            <Label className="text-xs font-semibold text-slate-700 dark:text-slate-200">
              매핑된 가이드 (articleIds · 순서대로 노출)
            </Label>
            <RoleStarterMapper
              initial={initialArticles}
              fieldName="articleIds"
              search={searchArticles}
              placeholder="아티클 검색 (제목 또는 slug, 2자 이상)"
              emptyText="아직 매핑된 가이드가 없어요. 아래 검색에서 추가하세요."
            />
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              /role/{item!.roleKey} 페이지에 이 순서대로 카드 노출됩니다.
            </p>
          </div>

          <div className="flex flex-col gap-1.5 rounded-md border border-slate-200 bg-slate-50/40 p-3 dark:border-slate-800 dark:bg-slate-900/30">
            <Label className="text-xs font-semibold text-slate-700 dark:text-slate-200">
              매핑된 FAQ (faqIds · 순서대로 노출)
            </Label>
            <RoleStarterMapper
              initial={initialFaqs}
              fieldName="faqIds"
              search={searchFaqs}
              placeholder="FAQ 검색 (질문, 2자 이상)"
              emptyText="아직 매핑된 FAQ가 없어요. 아래 검색에서 추가하세요."
            />
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              /role/{item!.roleKey} 페이지 “자주 묻는 질문” 영역에 노출됩니다.
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          {isEdit ? '저장' : '업서트'}
        </Button>
        {isEdit && (
          <Button
            type="button"
            variant={item!.isActive ? 'ghost' : 'outline'}
            onClick={toggleActive}
            disabled={pending}
          >
            {item!.isActive ? '비활성화' : '복구'}
          </Button>
        )}
      </div>
    </form>
  );
}
