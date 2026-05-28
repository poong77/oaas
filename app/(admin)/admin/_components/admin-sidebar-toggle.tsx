'use client';

/**
 * AdminSidebarToggle — 사이드바 접기/펼치기 토글.
 *
 * 동작:
 *   - 클릭 시 sidebarCollapsed 쿠키 변경 + router.refresh() → RSC 재실행
 *   - 단축키 `[` 접기 / `]` 펼치기 (입력 필드 focus 시 무시)
 *   - Cmd/Ctrl/Alt 동반 시 무시 (브라우저 단축키 충돌 방지)
 *
 * @see docs/02-design/features/admin-sidebar-layout.design.md §3.4
 */

import { useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import {
  SIDEBAR_COLLAPSED_COOKIE,
  SIDEBAR_COLLAPSED_MAX_AGE,
} from '@/lib/sidebar-state';

interface AdminSidebarToggleProps {
  collapsed: boolean;
}

/** input/textarea/select/contenteditable focus 여부 검사. */
function isEditableElement(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (el.isContentEditable) return true;
  return false;
}

export function AdminSidebarToggle({ collapsed }: AdminSidebarToggleProps) {
  const router = useRouter();

  const setCollapsed = useCallback(
    (next: boolean) => {
      const secure = window.location.protocol === 'https:' ? '; Secure' : '';
      if (next) {
        document.cookie = `${SIDEBAR_COLLAPSED_COOKIE}=1; path=/; max-age=${SIDEBAR_COLLAPSED_MAX_AGE}; samesite=lax${secure}`;
      } else {
        document.cookie = `${SIDEBAR_COLLAPSED_COOKIE}=; path=/; max-age=0; samesite=lax`;
      }
      router.refresh();
    },
    [router],
  );

  const toggle = useCallback(() => setCollapsed(!collapsed), [collapsed, setCollapsed]);

  // 단축키 [ ] — 입력 필드 focus 시 무시
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isEditableElement(e.target)) return;
      if (e.key === '[') {
        e.preventDefault();
        setCollapsed(true);
      } else if (e.key === ']') {
        e.preventDefault();
        setCollapsed(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setCollapsed]);

  const Icon = collapsed ? PanelLeftOpen : PanelLeftClose;
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={collapsed ? '사이드바 펼치기 (])' : '사이드바 접기 ([)'}
      title={collapsed ? '사이드바 펼치기 (])' : '사이드바 접기 ([)'}
      className={
        collapsed
          ? 'flex h-9 w-full items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
          : 'flex h-9 w-full items-center justify-end gap-1 px-2.5 text-[11px] text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
      }
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      {!collapsed && <span className="truncate">접기</span>}
    </button>
  );
}
