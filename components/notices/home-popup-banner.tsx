'use client';

/**
 * NT-04 홈 팝업 배너 — 홈 진입 시 활성 팝업 공지를 모달로 노출.
 *
 * 서버(app/page.tsx)에서 listActivePopupNotices() 결과를 props로 받는다.
 * "오늘 하루 보지 않기"는 서버 데이터가 아니라 브라우저 localStorage로 처리:
 *   key  = `oa-popup-dismiss:{noticeId}`
 *   value = 'YYYY-MM-DD' (해당 날짜에는 재노출 안 함)
 *
 * 닫기(X/닫기)는 이번 세션만 닫음 — 다음 홈 진입 시 다시 노출.
 */

import { useEffect, useState } from 'react';
import type { PopupNoticeItem } from '@/lib/services/notices';
import { PopupBannerModal } from './popup-banner-modal';

const DISMISS_PREFIX = 'oa-popup-dismiss:';

/** 로컬 기준 오늘 날짜 'YYYY-MM-DD' */
function todayKey(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function HomePopupBanner({ notices }: { notices: PopupNoticeItem[] }) {
  // 노출할 공지 (오늘 미차단 중 첫 번째). null = 노출 안 함
  const [active, setActive] = useState<PopupNoticeItem | null>(null);

  useEffect(() => {
    if (notices.length === 0) return;
    const today = todayKey();
    const next = notices.find((n) => {
      try {
        return localStorage.getItem(`${DISMISS_PREFIX}${n.id}`) !== today;
      } catch {
        return true; // localStorage 접근 불가 시 노출
      }
    });
    if (next) setActive(next);
  }, [notices]);

  if (!active) return null;

  const dismissToday = () => {
    try {
      localStorage.setItem(`${DISMISS_PREFIX}${active.id}`, todayKey());
    } catch {
      /* 무시 */
    }
    setActive(null);
  };

  return (
    <PopupBannerModal
      imageUrl={active.popupImageUrl}
      size={active.popupSize}
      title={active.title}
      href={`/notices/${active.id}`}
      onClose={() => setActive(null)}
      onDismissToday={dismissToday}
    />
  );
}
