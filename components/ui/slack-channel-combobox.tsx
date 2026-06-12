'use client';

/**
 * Slack 채널 검색형 선택기 (호텔-슬랙 채널 연동에서 사용).
 *
 * - 입력값으로 `/api/admin/slack/channels?q=`를 디바운스 검색.
 *   채널명(부분일치) 또는 채널 ID(`C…`/`G…`) 직접 입력 모두 지원(서버에서 분기).
 * - 비공개 채널은 자물쇠 아이콘, 봇 미참여 채널은 안내 태그.
 * - 선택 시 onSelect(channel) 콜백 호출 (선택 후 입력값 초기화).
 */

import * as React from 'react';
import { Search, Hash, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SlackChannelOption = {
  id: string;
  name: string;
  isPrivate: boolean;
  isMember: boolean;
};

export function SlackChannelCombobox({
  onSelect,
  disabled,
  placeholder = '채널명(oa-hotel) 또는 채널ID(C01ABC23)',
}: {
  onSelect: (channel: SlackChannelOption) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [query, setQuery] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [results, setResults] = React.useState<SlackChannelOption[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [reason, setReason] = React.useState<string | null>(null);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const reqId = React.useRef(0);

  React.useEffect(() => {
    function onDocPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('pointerdown', onDocPointerDown);
    return () => document.removeEventListener('pointerdown', onDocPointerDown);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const q = query.trim();
    const myReq = ++reqId.current;
    setLoading(true);
    setReason(null);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/admin/slack/channels?q=${encodeURIComponent(q)}`,
          { cache: 'no-store' },
        );
        const json = await res.json().catch(() => ({}));
        if (myReq !== reqId.current) return;
        if (Array.isArray(json?.items)) setResults(json.items);
        else setResults([]);
        if (json?.ok === false) setReason(json?.reason ?? 'slack_error');
      } catch {
        if (myReq === reqId.current) setResults([]);
      } finally {
        if (myReq === reqId.current) setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query, open]);

  function handleSelect(ch: SlackChannelOption) {
    onSelect(ch);
    setQuery('');
    setOpen(false);
    setResults([]);
  }

  return (
    <div ref={rootRef} className="relative max-w-md">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-label="슬랙 채널 검색"
          autoComplete="off"
          disabled={disabled}
          value={query}
          placeholder={placeholder}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          className={cn(
            'flex h-9 w-full rounded-md border border-slate-200 bg-white py-1 pl-8 pr-3 text-sm shadow-sm transition-colors',
            'placeholder:text-slate-400',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50 dark:placeholder:text-slate-500',
          )}
        />
      </div>

      {open && (
        <div className="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
          {loading ? (
            <div className="px-3 py-6 text-center text-sm text-slate-400">
              검색 중…
            </div>
          ) : reason === 'slack_not_configured' ? (
            <div className="px-3 py-4 text-center text-xs text-amber-600 dark:text-amber-400">
              Slack 토큰/스코프가 설정되지 않았습니다.
              <br />
              (channels:read · groups:read · channels:join 추가 + 재설치 필요)
            </div>
          ) : results.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-slate-400">
              {query.trim() ? '검색 결과가 없습니다' : '채널명 또는 채널 ID를 입력하세요'}
            </div>
          ) : (
            results.map((ch) => (
              <button
                key={ch.id}
                type="button"
                onClick={() => handleSelect(ch)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-brand-50 dark:hover:bg-brand-950/40"
              >
                {ch.isPrivate ? (
                  <Lock className="h-4 w-4 shrink-0 text-slate-400" />
                ) : (
                  <Hash className="h-4 w-4 shrink-0 text-slate-400" />
                )}
                <span className="truncate font-medium text-slate-800 dark:text-slate-100">
                  {ch.name}
                </span>
                <span className="shrink-0 font-mono text-xs text-slate-400">
                  {ch.id}
                </span>
                <span className="ml-auto shrink-0 text-[11px] font-semibold">
                  {ch.isMember ? (
                    <span className="text-green-600 dark:text-green-400">봇 참여중</span>
                  ) : ch.isPrivate ? (
                    <span className="text-amber-600 dark:text-amber-400">수동 초대 필요</span>
                  ) : (
                    <span className="text-brand-600 dark:text-brand-400">자동입장</span>
                  )}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
