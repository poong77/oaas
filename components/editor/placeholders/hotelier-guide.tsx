'use client';

/**
 * 호텔리어 가이드 — "예시 채우기" prefill 버튼.
 *
 * 빈 본문 상태에서만 노출. 클릭 시 표준 템플릿을 RichEditor 본문에 prefill.
 * ticket-create-form (IC-01) / reply-form 등에서 재사용.
 */

import { cn } from '@/lib/utils';

const DEFAULT_TICKET_TEMPLATE = [
  '**발생 시간**: ',
  '',
  '**객실/위치**: ',
  '',
  '**증상**: ',
  '',
  '**시도해본 조치**: ',
  '',
].join('\n');

const DEFAULT_REPLY_TEMPLATE = [
  '**추가로 확인된 내용**: ',
  '',
  '**스크린샷·로그**: (필요 시 본문에 첨부)',
  '',
].join('\n');

export type HotelierGuideVariant = 'new-ticket' | 'reply';

interface HotelierGuideButtonProps {
  variant?: HotelierGuideVariant;
  hidden?: boolean;
  onApply: (template: string) => void;
  className?: string;
}

export function HotelierGuideButton({
  variant = 'new-ticket',
  hidden = false,
  onApply,
  className,
}: HotelierGuideButtonProps) {
  if (hidden) return null;
  const template =
    variant === 'reply' ? DEFAULT_REPLY_TEMPLATE : DEFAULT_TICKET_TEMPLATE;

  return (
    <button
      type="button"
      onClick={() => onApply(template)}
      className={cn(
        'text-xs text-brand-600 hover:text-brand-700 hover:underline dark:text-brand-400',
        className,
      )}
    >
      예시 채우기 ↳
    </button>
  );
}
