import { cn } from '@/lib/utils';
import {
  NOTICE_KIND_CLASSES,
  NOTICE_KIND_META,
} from '@/lib/services/notices-meta';
import type { NoticeKind } from '@/db/schema';

/**
 * NoticeKindBadge — 공지 종류 뱃지(공지사항/릴리즈/서비스 장애)의 단일 기준.
 *
 * 크기/모양은 여기서만 관리한다(목록·상세·검색·홈 전부 동일).
 * 색상은 NOTICE_KIND_CLASSES, 라벨은 NOTICE_KIND_META에서 중앙 관리.
 * spec: w 68px · h 26px · radius 6px · padding 4px 6px
 */
export function NoticeKindBadge({
  kind,
  className,
}: {
  kind: NoticeKind;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex h-[26px] w-[68px] shrink-0 items-center justify-center whitespace-nowrap rounded-md px-1.5 py-1 text-xs font-medium',
        NOTICE_KIND_CLASSES[kind],
        className,
      )}
    >
      {NOTICE_KIND_META[kind].label}
    </span>
  );
}
