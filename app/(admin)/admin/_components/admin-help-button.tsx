'use client';

/**
 * AdminHelpButton — 운영자(어드민/매니저) 단축키·에디터 가이드 트리거.
 *
 * 클릭 시 우측에서 슬라이드 인하는 Sheet로 도움말 본문 노출.
 * 본문은 `/admin/help/editor` 페이지와 동일한 `AdminEditorHelpContent` 재사용.
 *
 * 3가지 배치 모드 (placement prop):
 *   - 'sidebar-expanded': 사이드바 footer 펼침. 아이콘 + "도움말" 라벨 풀폭 버튼
 *   - 'sidebar-collapsed': 사이드바 footer 접힘. 아이콘만 (정사각형)
 *   - 'mobile-compact': 모바일 헤더 우측. 아이콘만 (8x8)
 */

import { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { AdminEditorHelpContent } from './admin-editor-help-content';

export type AdminHelpButtonPlacement =
  | 'sidebar-expanded'
  | 'sidebar-collapsed'
  | 'mobile-compact';

interface AdminHelpButtonProps {
  placement?: AdminHelpButtonPlacement;
}

export function AdminHelpButton({ placement = 'sidebar-expanded' }: AdminHelpButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          title="에디터·단축키 도움말"
          aria-label="에디터·단축키 도움말"
          className={cn(
            'group inline-flex items-center text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white',
            placement === 'sidebar-expanded' &&
              'h-8 w-full justify-start gap-1.5 rounded-md px-2 text-xs font-medium',
            placement === 'sidebar-collapsed' &&
              'mx-auto h-8 w-8 justify-center rounded-md',
            placement === 'mobile-compact' &&
              'h-8 w-8 justify-center rounded-full',
          )}
        >
          <HelpCircle
            className={cn(
              'shrink-0',
              placement === 'mobile-compact' ? 'h-4 w-4' : 'h-3.5 w-3.5',
            )}
            aria-hidden
          />
          {placement === 'sidebar-expanded' && (
            <span className="truncate">도움말</span>
          )}
        </button>
      </SheetTrigger>

      <SheetContent
        side="right"
        className="w-full overflow-y-auto p-5 sm:max-w-2xl"
      >
        <SheetHeader className="pr-10">
          <SheetTitle>리치 에디터 운영자 가이드</SheetTitle>
          <SheetDescription>
            공지·아티클·FAQ·체크리스트·빠른답변·티켓 답변에서 사용하는 통합 에디터의 단축키·기능 안내입니다.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-5">
          <AdminEditorHelpContent />
        </div>
      </SheetContent>
    </Sheet>
  );
}
