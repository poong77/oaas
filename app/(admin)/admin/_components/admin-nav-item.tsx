'use client';

/**
 * AdminNavItem — 사이드바·모바일 Sheet 공유 단일 메뉴 항목.
 *
 * 3가지 모드:
 *   - 펼침 (collapsed=false): 아이콘 + 라벨 + (자물쇠 시 Lock 아이콘)
 *   - 접힘 (collapsed=true): 아이콘만 + hover tooltip + 자물쇠 시 Lock 배지 오버레이
 *   - 모바일 Sheet (onNavigate 전달): 펼침 모드 + 클릭 시 Sheet 닫기 콜백
 *
 * 활성 표시:
 *   - 텍스트 정렬 흔들림 방지 위해 ::before pseudo-element로 3px left border
 *   - 활성 + 자물쇠 동시 발생 불가 (locked는 권한 없음 → 활성 진입 불가)
 *
 * @see docs/02-design/features/admin-sidebar-layout.design.md §3.3
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { NavItem } from '../_data/nav-items';

interface AdminNavItemProps {
  item: NavItem;
  locked: boolean;
  collapsed: boolean;
  /** Sheet 내부 사용 시 클릭 후 Sheet 닫기용 콜백 */
  onNavigate?: () => void;
}

export function AdminNavItem({ item, locked, collapsed, onNavigate }: AdminNavItemProps) {
  const pathname = usePathname();
  const active =
    !locked && (pathname === item.href || pathname.startsWith(item.href + '/'));
  const Icon = item.icon;

  const itemClasses = cn(
    'group relative flex items-center gap-2 rounded-md px-2.5 py-2 text-sm font-medium transition-colors',
    active && [
      'bg-brand-100/60 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300',
      "before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[3px] before:rounded-r-full before:bg-brand-600 dark:before:bg-brand-400 before:content-['']",
    ],
    !active &&
      !locked &&
      'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800',
    locked && 'cursor-not-allowed text-slate-400 dark:text-slate-500',
    collapsed && 'justify-center',
  );

  // 아이콘 + (접힘 + 자물쇠 시 Lock 오버레이)
  const IconElement = (
    <span className="relative shrink-0">
      <Icon className="h-4 w-4" aria-hidden />
      {locked && collapsed && (
        <Lock
          className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 text-slate-400 opacity-70 dark:text-slate-500"
          aria-hidden
        />
      )}
    </span>
  );

  // 접힘 상태 hover tooltip (사이드바 우측으로 노출)
  const Tooltip = collapsed && (
    <span
      role="tooltip"
      className="pointer-events-none absolute left-full top-1/2 ml-2 hidden -translate-y-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs text-white shadow-md group-hover:block group-focus-visible:block dark:bg-slate-100 dark:text-slate-900"
    >
      {item.label}
      {locked && ' (어드민 권한 필요)'}
    </span>
  );

  if (locked) {
    return (
      <button
        type="button"
        disabled
        aria-disabled="true"
        title={`${item.label} — 어드민 권한 필요`}
        className={itemClasses}
      >
        {IconElement}
        {!collapsed && (
          <>
            <span className="flex-1 truncate text-left">{item.label}</span>
            <Lock className="h-3 w-3 shrink-0" aria-hidden />
          </>
        )}
        {Tooltip}
      </button>
    );
  }

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={itemClasses}
    >
      {IconElement}
      {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
      {Tooltip}
    </Link>
  );
}
