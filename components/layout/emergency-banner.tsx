/**
 * 긴급 공지 배너 (NT-03) — RSC.
 *
 * service_status 최신이 'incident'일 때만 헤더 위에 sticky로 노출.
 * 메시지는 plain text 렌더 (JSX 자동 escape로 XSS 방지).
 *
 * 평상시 (normal)에는 null 반환 → DOM에 아무것도 추가되지 않음.
 */

import Link from 'next/link';
import { AlertOctagon } from 'lucide-react';
import { getLatestServiceStatus } from '@/lib/services/service-status';

export async function EmergencyBanner() {
  const latest = await getLatestServiceStatus();

  if (latest.status !== 'incident') {
    return null;
  }

  // message는 신뢰할 수 없는 입력 (매니저가 작성)이지만
  // JSX 텍스트 자식으로 렌더하므로 React가 자동 escape.
  const message = (latest.message ?? '서비스 장애가 발생했습니다.').trim();

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="sticky top-0 z-50 w-full border-b border-red-700 bg-red-600 text-white shadow-md"
    >
      <div className="mx-auto flex w-full max-w-6xl items-start gap-2 px-4 py-2 text-sm sm:items-center sm:px-6 lg:px-8">
        <AlertOctagon className="mt-0.5 h-4 w-4 shrink-0 sm:mt-0" />
        <div className="flex flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-2">
          <span className="font-semibold tracking-tight">[장애 발생]</span>
          <span className="line-clamp-2 sm:line-clamp-1">{message}</span>
        </div>
        <Link
          href="/status"
          className="shrink-0 rounded-md bg-white/15 px-2 py-1 text-xs font-medium hover:bg-white/25 sm:text-sm"
        >
          자세히 보기 →
        </Link>
      </div>
    </div>
  );
}
