'use client';

import { Printer, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * 공지 상세 하단 액션바.
 * - 인쇄: window.print()
 * - 공유: URL 클립보드 복사 (Web Share API 가능하면 그것 우선)
 */
export function NoticeActionsBar({
  noticeId,
  title,
  className,
}: {
  noticeId: string;
  title: string;
  className?: string;
}) {
  async function handleShare() {
    const url =
      typeof window !== 'undefined'
        ? `${window.location.origin}/notices/${noticeId}`
        : '';
    if (
      typeof navigator !== 'undefined' &&
      'share' in navigator &&
      typeof navigator.share === 'function'
    ) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // 사용자가 취소했거나 실패 — 클립보드 fallback
      }
    }
    if (
      typeof navigator !== 'undefined' &&
      'clipboard' in navigator &&
      navigator.clipboard
    ) {
      try {
        await navigator.clipboard.writeText(url);
        toast.success('링크를 클립보드에 복사했습니다');
        return;
      } catch {
        // 마지막 fallback — 토스트만
      }
    }
    toast.info(`링크: ${url}`);
  }

  function handlePrint() {
    if (typeof window !== 'undefined') {
      window.print();
    }
  }

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2 border-t border-slate-200 pt-4 dark:border-slate-800',
        className,
      )}
    >
      <Button type="button" variant="outline" size="sm" onClick={handleShare}>
        <Share2 className="h-3.5 w-3.5" />
        공유
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={handlePrint}>
        <Printer className="h-3.5 w-3.5" />
        인쇄
      </Button>
    </div>
  );
}
