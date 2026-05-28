'use client';

/**
 * 클라이언트용 viewMode hook.
 *
 * - 첫 렌더는 항상 `isViewMode: false` 반환 (서버 결과와 일관성 유지).
 * - 마운트 후 useEffect에서 실제 쿠키값 반영.
 * - 토글 시 document.cookie 직접 조작 + router.refresh()로 RSC 재실행.
 *
 * SSR 일관성: 서버에서 RoleScope가 이미 cookies()로 정확한 mode를 결정해
 * UI 트리를 렌더한다. 본 hook은 그 결정과 동기화된 클라이언트 상태만 보장.
 */

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

const VIEW_MODE_COOKIE = 'viewMode';
const VIEW_MODE_MAX_AGE = 60 * 60 * 4; // 4시간 — lib/view-mode.ts와 동일

function readCookieValue(): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(VIEW_MODE_COOKIE + '='));
  return match ? decodeURIComponent(match.split('=')[1] ?? '') : undefined;
}

export function useViewMode() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [cookieValue, setCookieValue] = useState<string | undefined>(undefined);

  useEffect(() => {
    setMounted(true);
    setCookieValue(readCookieValue());
  }, []);

  const setHotelierView = useCallback(() => {
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${VIEW_MODE_COOKIE}=hotelier; path=/; max-age=${VIEW_MODE_MAX_AGE}; samesite=lax${secure}`;
    setCookieValue('hotelier');
    router.refresh();
  }, [router]);

  const clearViewMode = useCallback(() => {
    document.cookie = `${VIEW_MODE_COOKIE}=; path=/; max-age=0; samesite=lax`;
    setCookieValue(undefined);
    router.refresh();
  }, [router]);

  return {
    /** 마운트 전에는 항상 false (hydration mismatch 차단) */
    isViewMode: mounted ? cookieValue === 'hotelier' : false,
    setHotelierView,
    clearViewMode,
  };
}
