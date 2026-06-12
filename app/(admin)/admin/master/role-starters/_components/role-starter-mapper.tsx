'use client';

/**
 * RoleStarterMapper — 역할별 시작 매핑 UI (제네릭: 아티클·FAQ 공용, D3).
 *
 * 흐름:
 *   - 매핑된 엔티티 카드 리스트 (순서 = 배열 순서)
 *   - 각 카드: 드래그 핸들 + ↑ ↓ ✕
 *   - 검색 input → 자동완성 드롭다운 → 클릭으로 추가
 *
 * Form 직렬화:
 *   - 각 id를 hidden `<input name={fieldName} />` 로 렌더 (예: articleIds / faqIds)
 *   - 부모 form의 FormData.getAll(fieldName) 로 순서 보존된 배열 받음
 *
 * @see docs/02-design/knowledge-base-overhaul/DESIGN.md §15-2-4
 */

import { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  GripVertical,
  Loader2,
  Search,
  X,
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Input } from '@/components/ui/input';

/** 매핑 대상 엔티티의 공통 표시 모델. */
export interface MappedEntity {
  id: string;
  /** 카드 제목 (아티클 title / FAQ question). */
  title: string;
  /** 보조 메타 (예: "pms · /slug" 또는 "pms · error"). */
  meta: string;
}

export interface RoleStarterMapperProps {
  /** 초기 매핑 (page.tsx에서 배열 순서대로 fetch). */
  initial: MappedEntity[];
  /** hidden input name — FormData 직렬화 키 (articleIds / faqIds). */
  fieldName: string;
  /** 자동완성 검색 (2자 이상 시 호출). */
  search: (q: string) => Promise<MappedEntity[]>;
  placeholder?: string;
  emptyText?: string;
}

export function RoleStarterMapper({
  initial,
  fieldName,
  search,
  placeholder = '검색 (2자 이상)',
  emptyText = '아직 매핑된 항목이 없어요. 아래 검색에서 추가하세요.',
}: RoleStarterMapperProps) {
  const [items, setItems] = useState<MappedEntity[]>(initial);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MappedEntity[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // @dnd-kit 드래그 정렬 (마우스 + 키보드 a11y 지원)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setItems((prev) => {
      const oldIdx = prev.findIndex((p) => p.id === active.id);
      const newIdx = prev.findIndex((p) => p.id === over.id);
      if (oldIdx < 0 || newIdx < 0) return prev;
      return arrayMove(prev, oldIdx, newIdx);
    });
  }

  // initial 변경 시 동기 (보수적)
  useEffect(() => {
    setItems(initial);
  }, [initial.map((a) => a.id).join(',')]);

  // 검색 debounce
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const id = setTimeout(() => {
      search(query.trim())
        .then((rows) => {
          if (cancelled) return;
          setResults(rows);
        })
        .catch(() => {
          if (cancelled) return;
          setResults([]);
        })
        .finally(() => {
          if (cancelled) return;
          setLoading(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [query]);

  const currentIds = new Set(items.map((i) => i.id));

  function add(a: MappedEntity) {
    if (currentIds.has(a.id)) return;
    setItems((prev) => [...prev, a]);
    setQuery('');
    setResults([]);
    setSearchOpen(false);
  }

  function remove(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  function move(id: string, delta: -1 | 1) {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.id === id);
      if (idx < 0) return prev;
      const next = idx + delta;
      if (next < 0 || next >= prev.length) return prev;
      const copy = [...prev];
      const [removed] = copy.splice(idx, 1);
      copy.splice(next, 0, removed!);
      return copy;
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {items.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-300 bg-slate-50/40 px-3 py-4 text-center text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900/30">
          {emptyText}
        </p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={items.map((a) => a.id)}
            strategy={verticalListSortingStrategy}
          >
            <ol className="flex flex-col gap-1.5">
              {items.map((a, i) => (
                <SortableRow
                  key={a.id}
                  a={a}
                  index={i}
                  total={items.length}
                  fieldName={fieldName}
                  onMoveUp={() => move(a.id, -1)}
                  onMoveDown={() => move(a.id, 1)}
                  onRemove={() => remove(a.id)}
                />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      )}

      {items.length > 1 && (
        <p className="text-[10px] text-slate-400">
          드래그하거나 ↑↓ 버튼 / 키보드 화살표로 순서를 바꿀 수 있어요.
        </p>
      )}

      {/* 검색 + 자동완성 */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-2.5 h-3.5 w-3.5 text-slate-400" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSearchOpen(true);
          }}
          onFocus={() => setSearchOpen(true)}
          onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
          placeholder={placeholder}
          className="pl-7"
        />
        {loading && (
          <Loader2 className="absolute right-2 top-2.5 h-3.5 w-3.5 animate-spin text-slate-400" />
        )}
        {searchOpen && results.length > 0 && (
          <ul
            role="listbox"
            className="absolute left-0 right-0 top-full z-10 mt-1 max-h-64 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900"
          >
            {results.map((r) => {
              const has = currentIds.has(r.id);
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    disabled={has}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => add(r)}
                    className={`flex w-full flex-col items-start gap-0.5 px-3 py-1.5 text-left hover:bg-brand-50 dark:hover:bg-brand-950/30 ${
                      has ? 'cursor-not-allowed opacity-50' : ''
                    }`}
                  >
                    <span className="text-xs font-medium text-slate-900 dark:text-slate-100">
                      {r.title}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {r.meta} {has && '· 이미 추가됨'}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SortableRow — 단일 매핑 행 (@dnd-kit useSortable)
// ─────────────────────────────────────────────────────────────────────────────

function SortableRow({
  a,
  index,
  total,
  fieldName,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  a: MappedEntity;
  index: number;
  total: number;
  fieldName: string;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: a.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 'auto',
  } as const;

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900"
    >
      <input type="hidden" name={fieldName} value={a.id} />
      <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded bg-slate-100 text-[10px] font-semibold tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-300">
        {index + 1}
      </span>
      <button
        type="button"
        aria-label="드래그 핸들"
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none text-slate-300 hover:text-slate-500 active:cursor-grabbing"
      >
        <GripVertical className="h-3 w-3" />
      </button>
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-medium text-slate-900 dark:text-slate-100">
          {a.title}
        </div>
        <div className="truncate text-[10px] text-slate-500">{a.meta}</div>
      </div>
      <button
        type="button"
        onClick={onMoveUp}
        disabled={index === 0}
        aria-label="위로"
        className="inline-flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-50 hover:text-slate-700 disabled:opacity-30 dark:hover:bg-slate-800"
      >
        <ArrowUp className="h-3 w-3" />
      </button>
      <button
        type="button"
        onClick={onMoveDown}
        disabled={index === total - 1}
        aria-label="아래로"
        className="inline-flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-50 hover:text-slate-700 disabled:opacity-30 dark:hover:bg-slate-800"
      >
        <ArrowDown className="h-3 w-3" />
      </button>
      <button
        type="button"
        onClick={onRemove}
        aria-label="제거"
        className="inline-flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-950/30"
      >
        <X className="h-3 w-3" />
      </button>
    </li>
  );
}
