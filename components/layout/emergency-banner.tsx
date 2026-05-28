/**
 * 긴급 배너 — NT-03 통합 (Phase 2 + Phase 7).
 *
 * 노출 조건:
 *   1) service_status 최신이 'incident' — 빨간 띠 (기존, 최상단)
 *   2) notices.banner=true AND is_active=true AND published_at IS NOT NULL
 *      AND (banner_until IS NULL OR banner_until > now()) — kind에 따라 색상 분기
 *
 * 둘 다 있으면 service_status 상단 + notices.banner 아래쪽으로 노출.
 * 모두 없으면 null 반환 → DOM에 아무것도 추가되지 않음.
 *
 * 메시지는 plain text 렌더 (JSX 자동 escape로 XSS 방지).
 */

import Link from 'next/link';
import { AlertOctagon, Megaphone } from 'lucide-react';
import { getLatestServiceStatus } from '@/lib/services/service-status';
import { listActiveBannerNotices } from '@/lib/services/notices';
import { NOTICE_BANNER_CLASSES } from '@/lib/services/notices-meta';

export async function EmergencyBanner() {
  const [latest, banners] = await Promise.all([
    getLatestServiceStatus(),
    listActiveBannerNotices(),
  ]);

  const showServiceIncident = latest.status === 'incident';
  const hasBannerNotices = banners.length > 0;

  if (!showServiceIncident && !hasBannerNotices) {
    return null;
  }

  return (
    <div className="sticky top-0 z-50 w-full shadow-md">
      {showServiceIncident && (
        <div
          role="alert"
          aria-live="assertive"
          className="w-full border-b border-red-700 bg-red-600 text-white"
        >
          <div className="mx-auto flex w-full max-w-6xl items-start gap-2 px-4 py-2 text-sm sm:items-center sm:px-6 lg:px-8">
            <AlertOctagon className="mt-0.5 h-4 w-4 shrink-0 sm:mt-0" />
            <div className="flex flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-2">
              <span className="font-semibold tracking-tight">[장애 발생]</span>
              <span className="line-clamp-2 sm:line-clamp-1">
                {(latest.message ?? '서비스 장애가 발생했습니다.').trim()}
              </span>
            </div>
            <Link
              href="/status"
              className="shrink-0 rounded-md bg-white/15 px-2 py-1 text-xs font-medium hover:bg-white/25 sm:text-sm"
            >
              자세히 보기 →
            </Link>
          </div>
        </div>
      )}

      {banners.map((notice) => {
        const meta = NOTICE_BANNER_CLASSES[notice.kind];
        return (
          <div
            key={notice.id}
            role="alert"
            aria-live="polite"
            className={`w-full ${meta.container}`}
          >
            <div className="mx-auto flex w-full max-w-6xl items-start gap-2 px-4 py-2 text-sm sm:items-center sm:px-6 lg:px-8">
              <Megaphone className="mt-0.5 h-4 w-4 shrink-0 sm:mt-0" />
              <div className="flex flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-2">
                <span className="font-semibold tracking-tight">
                  {meta.label}
                </span>
                <span className="line-clamp-2 sm:line-clamp-1">
                  {notice.title}
                </span>
              </div>
              <Link
                href={`/notices/${notice.id}`}
                className="shrink-0 rounded-md bg-white/15 px-2 py-1 text-xs font-medium hover:bg-white/25 sm:text-sm"
              >
                자세히 보기 →
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}
