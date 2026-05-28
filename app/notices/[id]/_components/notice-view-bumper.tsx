'use client';

import { useEffect, useRef } from 'react';
import { bumpNoticeViewCount } from '@/app/actions/notice-actions';

/**
 * 페이지 진입 시 view_count +1 (fire-and-forget).
 * StrictMode 더블 호출 회피용으로 ref 가드.
 */
export function NoticeViewBumper({ noticeId }: { noticeId: string }) {
  const bumpedRef = useRef(false);
  useEffect(() => {
    if (bumpedRef.current) return;
    bumpedRef.current = true;
    // 실패는 무시 (fire-and-forget)
    void bumpNoticeViewCount(noticeId).catch(() => {});
  }, [noticeId]);
  return null;
}
