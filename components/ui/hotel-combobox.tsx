'use client';

/**
 * 호텔 검색형 선택기 (드롭다운 대체).
 *
 * - 입력하면 띄어쓰기·하이픈·점 무시 + 영문 대소문자 무시로 매칭.
 *   ("더페이즈" → "더 페이즈 호텔", "thepalace" → "The Palace")
 * - 초기 목록(initialHotels)은 입력 전에도 노출되며, 입력 시 서버
 *   (`/api/admin/hotels?q=`)에서 100개 초과분까지 검색.
 * - 키보드(↑/↓/Enter/Esc) 탐색 + 클릭 선택 + 선택 해제 지원.
 *
 * 두 가지 사용 패턴 지원:
 *   1) native form: `name` 지정 → 선택값을 hidden input 으로 제출.
 *   2) controlled: `value` + `onChange(id, hotel)`.
 */

import * as React from 'react';
import { Search, X, Check, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { collapseSpacing } from '@/lib/text/normalize';

export type HotelLite = {
  id: string;
  name: string;
  oaPmsHotelId: string | null;
};

type HotelComboboxProps = {
  /** native form 제출용 hidden input name (예: "hotelId") */
  name?: string;
  /** controlled 선택 id */
  value?: string;
  /** uncontrolled 초기 선택 id */
  defaultValue?: string;
  /** 선택 변경 콜백 */
  onChange?: (id: string, hotel: HotelLite | null) => void;
  /** 입력 전 노출할 초기 호텔 목록 */
  initialHotels?: HotelLite[];
  /** 미리 선택된 id 의 라벨 표시용 (초기 목록에 없을 수 있는 경우) */
  initialSelected?: HotelLite | null;
  placeholder?: string;
  /** "미지정/해제" 선택지를 보여줄지 */
  allowEmpty?: boolean;
  /** 해제 선택지 라벨 */
  emptyLabel?: string;
  required?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  id?: string;
};

function filterLocal(list: HotelLite[], query: string): HotelLite[] {
  const c = collapseSpacing(query);
  if (!c) return list;
  return list.filter((h) => {
    const name = collapseSpacing(h.name);
    const oa = h.oaPmsHotelId ? collapseSpacing(h.oaPmsHotelId) : '';
    return name.includes(c) || oa.includes(c);
  });
}

export function HotelCombobox({
  name,
  value,
  defaultValue,
  onChange,
  initialHotels = [],
  initialSelected = null,
  placeholder = '호텔명을 검색하세요',
  allowEmpty = false,
  emptyLabel = '미지정',
  required,
  disabled,
  invalid,
  id,
}: HotelComboboxProps) {
  const isControlled = value !== undefined;
  const initialId = (isControlled ? value : defaultValue) ?? '';

  const findById = React.useCallback(
    (hid: string): HotelLite | null => {
      if (!hid) return null;
      if (initialSelected && initialSelected.id === hid) return initialSelected;
      return initialHotels.find((h) => h.id === hid) ?? null;
    },
    [initialHotels, initialSelected],
  );

  const [selectedId, setSelectedId] = React.useState<string>(initialId);
  const [selected, setSelected] = React.useState<HotelLite | null>(() =>
    findById(initialId),
  );
  const [query, setQuery] = React.useState<string>('');
  const [open, setOpen] = React.useState(false);
  const [results, setResults] = React.useState<HotelLite[]>(initialHotels);
  const [activeIndex, setActiveIndex] = React.useState(0);

  const rootRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const blurTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqId = React.useRef(0);

  // controlled value 동기화
  React.useEffect(() => {
    if (!isControlled) return;
    const v = value ?? '';
    if (v !== selectedId) {
      setSelectedId(v);
      setSelected(findById(v));
      setQuery('');
    }
  }, [value, isControlled, selectedId, findById]);

  // 외부 클릭 시 닫기
  React.useEffect(() => {
    function onDocPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('pointerdown', onDocPointerDown);
    return () => document.removeEventListener('pointerdown', onDocPointerDown);
  }, []);

  // 디바운스 서버 검색 (입력 시) + 즉시 로컬 필터
  React.useEffect(() => {
    if (!open) return;
    const q = query.trim();
    // 즉시 로컬 필터로 빠른 반응
    setResults(filterLocal(initialHotels, q));
    setActiveIndex(0);
    if (!q) return;

    const myReq = ++reqId.current;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/admin/hotels?q=${encodeURIComponent(q)}`,
          { cache: 'no-store' },
        );
        const json = await res.json().catch(() => ({}));
        if (myReq !== reqId.current) return; // 최신 요청만 반영
        if (Array.isArray(json?.items)) setResults(json.items);
      } catch {
        // 네트워크 실패 시 로컬 필터 결과 유지
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [query, open, initialHotels]);

  function commit(hotel: HotelLite | null) {
    const hid = hotel?.id ?? '';
    // controlled/uncontrolled 모두 라벨 표시를 위해 로컬 상태를 갱신.
    // controlled 의 경우 부모 value 변경분은 동기화 effect 에서 selectedId 와
    // 일치하므로 덮어쓰지 않는다 (서버 검색으로 초기 목록 밖 호텔도 표시됨).
    setSelectedId(hid);
    setSelected(hotel);
    setQuery('');
    setOpen(false);
    onChange?.(hid, hotel);
  }

  function openPanel() {
    if (disabled) return;
    setResults(filterLocal(initialHotels, ''));
    setActiveIndex(0);
    setOpen(true);
  }

  // 옵션 목록 (해제 선택지 포함)
  const options: Array<{ kind: 'empty' } | { kind: 'hotel'; hotel: HotelLite }> =
    [
      ...(allowEmpty && !query.trim()
        ? [{ kind: 'empty' as const }]
        : []),
      ...results.map((h) => ({ kind: 'hotel' as const, hotel: h })),
    ];

  function selectByIndex(idx: number) {
    const opt = options[idx];
    if (!opt) return;
    if (opt.kind === 'empty') commit(null);
    else commit(opt.hotel);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      openPanel();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      selectByIndex(activeIndex);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setQuery('');
    }
  }

  function handleBlur() {
    // 옵션 클릭(pointerdown)이 먼저 처리되도록 지연 후 닫기
    blurTimer.current = setTimeout(() => {
      setOpen(false);
      setQuery('');
    }, 120);
  }

  function cancelBlurClose() {
    if (blurTimer.current) {
      clearTimeout(blurTimer.current);
      blurTimer.current = null;
    }
  }

  // 입력창에 표시되는 값: 검색 중이면 query, 아니면 선택된 호텔명
  const displayValue = open ? query : selected?.name ?? '';

  return (
    <div ref={rootRef} className="relative">
      {name && <input type="hidden" name={name} value={selectedId} />}

      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          autoComplete="off"
          required={required && !selectedId}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          value={displayValue}
          placeholder={selected ? selected.name : placeholder}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={openPanel}
          onClick={openPanel}
          onBlur={handleBlur}
          onKeyDown={onKeyDown}
          className={cn(
            'flex h-9 w-full rounded-md border border-slate-200 bg-white py-1 pl-8 pr-8 text-sm shadow-sm transition-colors',
            'placeholder:text-slate-400',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50 dark:placeholder:text-slate-500',
            invalid && 'border-red-400 dark:border-red-500',
          )}
        />
        {selectedId && !disabled && (
          <button
            type="button"
            aria-label="선택 해제"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              commit(null);
              inputRef.current?.focus();
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {open && (
        <div
          className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
          onMouseDown={cancelBlurClose}
        >
          {options.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-slate-400">
              검색 결과가 없습니다
            </div>
          ) : (
            options.map((opt, idx) => {
              const active = idx === activeIndex;
              if (opt.kind === 'empty') {
                const isSel = !selectedId;
                return (
                  <button
                    key="__empty__"
                    type="button"
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => selectByIndex(idx)}
                    className={cn(
                      'flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-500',
                      active && 'bg-brand-50 dark:bg-brand-950/40',
                    )}
                  >
                    <Check
                      className={cn(
                        'h-4 w-4 shrink-0',
                        isSel ? 'text-brand-600' : 'text-transparent',
                      )}
                    />
                    <span className="italic">— {emptyLabel} —</span>
                  </button>
                );
              }
              const h = opt.hotel;
              const isSel = h.id === selectedId;
              return (
                <button
                  key={h.id}
                  type="button"
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => selectByIndex(idx)}
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-2 text-left text-sm',
                    active && 'bg-brand-50 dark:bg-brand-950/40',
                  )}
                >
                  <Check
                    className={cn(
                      'h-4 w-4 shrink-0',
                      isSel ? 'text-brand-600' : 'text-transparent',
                    )}
                  />
                  <Building2 className="h-4 w-4 shrink-0 text-slate-400" />
                  <span className="truncate text-slate-800 dark:text-slate-100">
                    {h.name}
                  </span>
                  {h.oaPmsHotelId && (
                    <span className="ml-auto shrink-0 text-xs text-slate-400">
                      {h.oaPmsHotelId}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
