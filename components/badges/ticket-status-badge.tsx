import { cn } from '@/lib/utils';

/**
 * TicketStatusBadge — 문의 상태 뱃지(접수/처리중/답변 완료)의 단일 기준.
 *
 * 크기/모양은 여기서만 관리한다(목록·홈 전부 동일).
 * 색상(`className`)·라벨(`label`)은 호출부에서 주입한다.
 * spec: w 69px · h 26px · radius 99px · padding 4px 12px · border
 */
export function TicketStatusBadge({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex h-[26px] w-[69px] shrink-0 items-center justify-center whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium',
        className,
      )}
    >
      {label}
    </span>
  );
}
