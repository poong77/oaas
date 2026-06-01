'use client';

/**
 * AdminGuideLink — 어드민·매니저 "업무 가이드"(신규 사용자용) 진입점.
 *
 * /admin/help/guide (인증 게이트된 정적 HTML 풀페이지)를 새 탭으로 연다.
 * 사이드바 footer의 AdminHelpButton(에디터 단축키 Sheet) 바로 옆에 배치한다.
 *
 * placement는 AdminHelpButton과 동일 API:
 *   - 'sidebar-expanded' : 사이드바 펼침. 아이콘 + "가이드" 라벨 풀폭
 *   - 'sidebar-collapsed': 사이드바 접힘. 아이콘만 (정사각형)
 *   - 'mobile-compact'   : 모바일 헤더 우측. 아이콘만
 */

import { BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

export type AdminGuideLinkPlacement =
  | 'sidebar-expanded'
  | 'sidebar-collapsed'
  | 'mobile-compact';

interface AdminGuideLinkProps {
  placement?: AdminGuideLinkPlacement;
}

export function AdminGuideLink({ placement = 'sidebar-expanded' }: AdminGuideLinkProps) {
  return (
    <a
      href="/admin/help/guide"
      target="_blank"
      rel="noopener"
      title="업무 가이드 (신규 사용자용) — 새 탭"
      aria-label="업무 가이드 (신규 사용자용)"
      className={cn(
        'group inline-flex items-center text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white',
        placement === 'sidebar-expanded' &&
          'h-8 w-full justify-start gap-1.5 rounded-md px-2 text-xs font-medium',
        placement === 'sidebar-collapsed' && 'mx-auto h-8 w-8 justify-center rounded-md',
        placement === 'mobile-compact' && 'h-8 w-8 justify-center rounded-full',
      )}
    >
      <BookOpen
        className={cn('shrink-0', placement === 'mobile-compact' ? 'h-4 w-4' : 'h-3.5 w-3.5')}
        aria-hidden
      />
      {placement === 'sidebar-expanded' && <span className="truncate">가이드</span>}
    </a>
  );
}
