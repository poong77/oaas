/**
 * viewMode 쿠키 read/write 유틸 (서버 전용).
 *
 * 클라이언트에서는 `lib/hooks/use-view-mode.ts`의 `useViewMode()` 사용.
 *
 * 쿠키 스펙:
 *   - 이름:    viewMode
 *   - 값:      'hotelier' (또는 미설정)
 *   - Path:    /
 *   - MaxAge:  4시간
 *   - HttpOnly: false (클라이언트 토글 가능해야 함)
 *   - Secure:  production만
 *   - SameSite: Lax
 *
 * 보안: UI 표시용. 위조해도 서버 권한 체크는 user.role 기준이므로 무해.
 */

import { cookies } from 'next/headers';

export const VIEW_MODE_COOKIE = 'viewMode';
export const VIEW_MODE_MAX_AGE = 60 * 60 * 4; // 4시간

export type ViewMode = 'hotelier' | null;

/** 서버 컴포넌트/액션에서 viewMode 읽기. */
export async function getViewMode(): Promise<ViewMode> {
  const cookieStore = await cookies();
  const value = cookieStore.get(VIEW_MODE_COOKIE)?.value;
  return value === 'hotelier' ? 'hotelier' : null;
}

/** 서버 액션에서 viewMode 설정/삭제. */
export async function setViewMode(value: ViewMode): Promise<void> {
  const cookieStore = await cookies();
  if (value === null) {
    cookieStore.delete(VIEW_MODE_COOKIE);
    return;
  }
  cookieStore.set(VIEW_MODE_COOKIE, value, {
    path: '/',
    maxAge: VIEW_MODE_MAX_AGE,
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  });
}
