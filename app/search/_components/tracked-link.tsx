'use client';

/**
 * 검색 결과 클릭 / 접수 전환을 기록하면서 이동하는 Link (Layer B).
 *
 * navigator.sendBeacon으로 /api/search/track에 fire-and-forget 전송 →
 * 페이지 이탈 중에도 안전. logId가 없으면(로깅 실패 시) 그냥 일반 Link처럼 동작.
 */

import Link from 'next/link';
import type { ReactNode } from 'react';

type Props = {
  logId: string | null;
  track: 'click' | 'ticket';
  href: string;
  className?: string;
  children: ReactNode;
  kind?: string;
  refId?: string;
  position?: number;
};

export function TrackedLink({
  logId,
  track,
  href,
  className,
  children,
  kind,
  refId,
  position,
}: Props) {
  function onClick() {
    if (!logId || typeof navigator === 'undefined' || !navigator.sendBeacon) {
      return;
    }
    try {
      const payload =
        track === 'ticket'
          ? { type: 'ticket', logId }
          : { type: 'click', logId, kind, ref: refId, position };
      navigator.sendBeacon(
        '/api/search/track',
        new Blob([JSON.stringify(payload)], { type: 'application/json' }),
      );
    } catch {
      // 무시
    }
  }

  return (
    <Link href={href} className={className} onClick={onClick}>
      {children}
    </Link>
  );
}
