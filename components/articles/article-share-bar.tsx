'use client';

import { useState } from 'react';
import { Printer, Share2, Link as LinkIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

/**
 * 아티클 공유 / 인쇄 버튼 모음.
 *
 * - 인쇄: `window.print()`
 * - 공유: Web Share API → 실패 시 clipboard 복사
 * - 링크 복사: 항상 노출
 */
export function ArticleShareBar({ title }: { title: string }) {
  const [pending, setPending] = useState(false);

  async function handleShare() {
    if (typeof window === 'undefined') return;
    const shareUrl = window.location.href;
    setPending(true);
    try {
      if (navigator.share) {
        try {
          await navigator.share({ title, url: shareUrl });
          return;
        } catch (err) {
          // 사용자가 취소한 경우는 무시
          if ((err as Error).name === 'AbortError') return;
        }
      }
      await navigator.clipboard.writeText(shareUrl);
      toast.success('링크가 복사되었습니다.');
    } catch {
      toast.error('공유 실패. 브라우저에서 URL을 직접 복사해주세요.');
    } finally {
      setPending(false);
    }
  }

  async function copyLink() {
    if (typeof window === 'undefined') return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success('링크가 복사되었습니다.');
    } catch {
      toast.error('복사 실패');
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => window.print()}
        title="인쇄"
      >
        <Printer className="h-3.5 w-3.5" />
        인쇄
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={handleShare}
        disabled={pending}
      >
        <Share2 className="h-3.5 w-3.5" />
        공유
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={copyLink}
        title="링크 복사"
      >
        <LinkIcon className="h-3.5 w-3.5" />
        링크
      </Button>
    </div>
  );
}
