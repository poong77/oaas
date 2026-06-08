'use client';

/**
 * 제품 분류(대/중/소 + 메모) 트리 편집기.
 *
 * - parent_id 기반 계층 트리. 대(0)/중(1)/소(2) 최대 3단.
 * - 노드: 접기/펼치기, 인라인 편집(코드·라벨·메모·정렬, 대분류는 아이콘), 비활성/복구, 하위 추가.
 * - 기존 마스터 액션 재사용 (createCategoryAction / updateCategoryAction / setCategoryActiveAction).
 *   ⚠️ update 시 parentId/icon을 hidden으로 함께 보내 위치·아이콘 유실을 방지한다.
 *
 * useFormState 대신 onSubmit + useTransition (프로젝트 컨벤션).
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  ChevronDown,
  ChevronRight,
  FolderTree,
  Plus,
  Save,
  X,
} from 'lucide-react';
import { resolveIcon, KNOWN_ICON_NAMES } from '@/components/icon-resolver';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useConfirmDialog } from '@/components/dialogs/confirm-dialog';
import {
  createCategoryAction,
  updateCategoryAction,
  setCategoryActiveAction,
} from '@/app/actions/master-actions';
import type { ProductCategoryAdminNode } from '@/lib/services/master-categories';

const DEPTH_LABEL = ['대분류', '중분류', '소분류'] as const;
const MAX_DEPTH = 2; // 0=대 · 1=중 · 2=소

export function ProductTreeEditor({
  tree,
}: {
  tree: ProductCategoryAdminNode[];
}) {
  const [addingRoot, setAddingRoot] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-end">
        <Button
          type="button"
          size="sm"
          variant={addingRoot ? 'outline' : 'default'}
          onClick={() => setAddingRoot((v) => !v)}
        >
          {addingRoot ? (
            <>
              <X className="h-4 w-4" /> 취소
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" /> 대분류 추가
            </>
          )}
        </Button>
      </div>

      {addingRoot && (
        <div className="rounded-lg border border-brand-200 bg-brand-50/40 p-3 dark:border-brand-800 dark:bg-brand-950/20">
          <AddChildForm
            parentId={null}
            depth={0}
            onDone={() => setAddingRoot(false)}
          />
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
        {tree.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-400">
            등록된 대분류가 없습니다. 우측 상단 “대분류 추가”로 시작하세요.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {tree.map((node) => (
              <TreeNode key={node.id} node={node} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function TreeNode({ node }: { node: ProductCategoryAdminNode }) {
  const router = useRouter();
  const confirm = useConfirmDialog();
  const [pending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(true);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);

  const hasChildren = node.children.length > 0;
  const canAddChild = node.depth < MAX_DEPTH;
  const Icon = node.depth === 0 ? resolveIcon(node.icon) : FolderTree;

  async function toggleActive() {
    const target = !node.isActive;
    const childNote =
      target || !hasChildren
        ? ''
        : ' 하위 항목은 그대로 두며, 비활성 분류는 일반 사용자에게 숨겨집니다.';
    const ok = await confirm({
      title: target ? '분류를 복구합니다' : '분류를 비활성화합니다',
      description: target
        ? '비활성화된 분류를 다시 활성화하시겠습니까?'
        : `비활성화 시 접수폼·홈에 노출되지 않지만 기존 티켓 참조는 유지됩니다.${childNote}`,
      confirmText: target ? '복구' : '비활성화',
      tone: target ? 'default' : 'danger',
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await setCategoryActiveAction(node.id, target);
      if (res.ok) {
        toast.success(target ? '복구되었습니다' : '비활성화되었습니다');
        router.refresh();
      } else {
        toast.error(res.message ?? '실패');
      }
    });
  }

  return (
    <li className={node.isActive ? '' : 'opacity-60'}>
      <div
        className="flex items-center gap-2 py-2.5 pr-3 hover:bg-slate-50 dark:hover:bg-slate-900/40"
        style={{ paddingLeft: `${12 + node.depth * 22}px` }}
      >
        {/* 펼치기/접기 */}
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700"
            aria-label={expanded ? '접기' : '펼치기'}
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        ) : (
          <span className="w-5 shrink-0" />
        )}

        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
            node.depth === 0
              ? 'bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-300'
              : node.depth === 1
                ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300'
                : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
          }`}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>

        <span className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
          {node.label}
        </span>
        <Badge tone="slate" className="shrink-0 font-mono text-[10px]">
          {node.code}
        </Badge>
        {node.memo && (
          <span className="truncate text-xs text-slate-400">— {node.memo}</span>
        )}
        {!node.isActive && (
          <Badge tone="slate" className="shrink-0 text-[10px]">
            비활성
          </Badge>
        )}
        {hasChildren && (
          <span className="shrink-0 text-[11px] text-slate-400">
            하위 {node.children.length}
          </span>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setEditing((v) => !v)}
            disabled={pending}
          >
            {editing ? '닫기' : '편집'}
          </Button>
          {canAddChild && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setAdding((v) => !v);
                setExpanded(true);
              }}
              disabled={pending}
              title={`${DEPTH_LABEL[node.depth + 1]} 추가`}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={toggleActive}
            disabled={pending}
          >
            {node.isActive ? '비활성' : '복구'}
          </Button>
        </div>
      </div>

      {/* 인라인 편집 */}
      {editing && (
        <div
          className="border-y border-slate-100 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-900/40"
          style={{ marginLeft: `${12 + node.depth * 22}px` }}
        >
          <EditForm node={node} onDone={() => setEditing(false)} />
        </div>
      )}

      {/* 하위 추가 */}
      {adding && canAddChild && (
        <div
          className="border-y border-brand-100 bg-brand-50/40 p-3 dark:border-brand-900 dark:bg-brand-950/20"
          style={{ marginLeft: `${12 + (node.depth + 1) * 22}px` }}
        >
          <AddChildForm
            parentId={node.id}
            depth={node.depth + 1}
            onDone={() => setAdding(false)}
          />
        </div>
      )}

      {/* 자식 */}
      {hasChildren && expanded && (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {node.children.map((child) => (
            <TreeNode key={child.id} node={child} />
          ))}
        </ul>
      )}
    </li>
  );
}

function EditForm({
  node,
  onDone,
}: {
  node: ProductCategoryAdminNode;
  onDone: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await updateCategoryAction(node.id, undefined, fd);
      if (res.ok) {
        toast.success('저장되었습니다');
        onDone();
        router.refresh();
      } else {
        toast.error(res.message ?? '저장 실패');
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="type" value="product" />
      {/* 위치(parent)·아이콘 보존: update는 form 값으로 덮어쓰므로 hidden 필수 */}
      <input type="hidden" name="parentId" value={node.parentId ?? ''} />
      {node.depth > 0 && (
        <input type="hidden" name="icon" value={node.icon ?? ''} />
      )}
      <FieldCode defaultValue={node.code} idSuffix={node.id} />
      <FieldLabel defaultValue={node.label} depth={node.depth} />
      <FieldMemo defaultValue={node.memo ?? ''} />
      {node.depth === 0 && (
        <FieldIcon defaultValue={node.icon ?? ''} idSuffix={node.id} />
      )}
      <FieldSort defaultValue={node.sortOrder} />
      <div className="flex items-center gap-1">
        <Button type="submit" size="sm" disabled={pending}>
          <Save className="h-3.5 w-3.5" /> 저장
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onDone}
          disabled={pending}
        >
          취소
        </Button>
      </div>
    </form>
  );
}

function AddChildForm({
  parentId,
  depth,
  onDone,
}: {
  parentId: string | null;
  depth: number;
  onDone: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    startTransition(async () => {
      const res = await createCategoryAction(undefined, fd);
      if (res.ok) {
        toast.success(`${DEPTH_LABEL[depth]}가 추가되었습니다`);
        form.reset();
        onDone();
        router.refresh();
      } else {
        toast.error(res.message ?? '추가 실패');
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="type" value="product" />
      <input type="hidden" name="parentId" value={parentId ?? ''} />
      <div className="flex items-center self-center">
        <Badge tone="brand" className="text-[10px]">
          {DEPTH_LABEL[depth]} 신규
        </Badge>
      </div>
      <FieldCode placeholder={depth === 0 ? '예: pms' : '예: pms_webpos'} />
      <FieldLabel placeholder="예: WebPOS" depth={depth} />
      <FieldMemo placeholder="예: 웹포스 / 결제" />
      {depth === 0 && <FieldIcon placeholder="Building2" />}
      <FieldSort defaultValue={100} />
      <div className="flex items-center gap-1">
        <Button type="submit" size="sm" disabled={pending}>
          <Plus className="h-3.5 w-3.5" /> 추가
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onDone}
          disabled={pending}
        >
          취소
        </Button>
      </div>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────
// 공통 입력 필드

function FieldCode({
  defaultValue,
  placeholder,
  idSuffix,
}: {
  defaultValue?: string;
  placeholder?: string;
  idSuffix?: string;
}) {
  return (
    <div className="flex w-32 flex-col gap-1">
      <Label className="text-[10px]">코드 *</Label>
      <Input
        name="code"
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="h-8 text-xs"
        required
        key={idSuffix}
      />
    </div>
  );
}

function FieldLabel({
  defaultValue,
  placeholder,
  depth,
}: {
  defaultValue?: string;
  placeholder?: string;
  depth: number;
}) {
  return (
    <div className="flex min-w-[140px] flex-1 flex-col gap-1">
      <Label className="text-[10px]">
        {(DEPTH_LABEL[depth] ?? '분류')} 라벨 *
      </Label>
      <Input
        name="label"
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="h-8 text-xs"
        required
      />
    </div>
  );
}

function FieldMemo({
  defaultValue,
  placeholder,
}: {
  defaultValue?: string;
  placeholder?: string;
}) {
  return (
    <div className="flex min-w-[140px] flex-1 flex-col gap-1">
      <Label className="text-[10px]">메모</Label>
      <Input
        name="memo"
        defaultValue={defaultValue}
        placeholder={placeholder ?? '예: 문의 디폴트값'}
        className="h-8 text-xs"
      />
    </div>
  );
}

function FieldIcon({
  defaultValue,
  placeholder,
  idSuffix,
}: {
  defaultValue?: string;
  placeholder?: string;
  idSuffix?: string;
}) {
  const listId = `icons-${idSuffix ?? 'new'}`;
  return (
    <div className="flex w-36 flex-col gap-1">
      <Label className="text-[10px]">아이콘 (lucide)</Label>
      <Input
        name="icon"
        defaultValue={defaultValue}
        placeholder={placeholder}
        list={listId}
        className="h-8 text-xs"
      />
      <datalist id={listId}>
        {KNOWN_ICON_NAMES.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
    </div>
  );
}

function FieldSort({ defaultValue }: { defaultValue: number }) {
  return (
    <div className="flex w-16 flex-col gap-1">
      <Label className="text-[10px]">정렬</Label>
      <Input
        name="sortOrder"
        type="number"
        defaultValue={defaultValue}
        className="h-8 text-xs"
      />
    </div>
  );
}
