/**
 * notices UI 메타 — client/server 양쪽에서 사용 가능 (server-only X).
 *
 * notices.ts는 server-only이므로 Client Component에서는 이 파일을 import.
 */

import type { NoticeKind, NoticePopupSize } from '@/db/schema';

export const NOTICE_KIND_META: Record<
  NoticeKind,
  {
    label: string;
    /** Badge tone 또는 인라인 className */
    badge: 'brand' | 'danger' | 'violet';
    /** 한 줄 설명 (어드민 select 등에서) */
    description: string;
  }
> = {
  notice: {
    label: '공지사항',
    badge: 'brand',
    description: '일반 공지 — 기능 안내, 운영 알림',
  },
  release: {
    label: '릴리즈',
    badge: 'violet',
    description: '릴리즈 노트 — 버전 업데이트 내역',
  },
  incident: {
    label: '서비스 장애',
    badge: 'danger',
    description: '장애 공지 — 진행/사후',
  },
};

/**
 * Badge 컴포넌트는 violet tone이 없으므로 인라인 className을 별도 제공.
 * 홈(home-notice-list)과 동일한 톤(sky/violet/rose)으로 통일 — 전 페이지 일관.
 */
export const NOTICE_KIND_CLASSES: Record<NoticeKind, string> = {
  notice:
    'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300',
  release:
    'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300',
  incident:
    'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
};

/** 배너용 색상 (emergency-banner에서 사용). */
export const NOTICE_BANNER_CLASSES: Record<
  NoticeKind,
  { container: string; label: string }
> = {
  notice: {
    container:
      'border-b border-amber-700 bg-amber-600 text-white',
    label: '[안내]',
  },
  release: {
    container:
      'border-b border-indigo-700 bg-indigo-600 text-white',
    label: '[업데이트]',
  },
  incident: {
    container: 'border-b border-red-700 bg-red-600 text-white',
    label: '[장애]',
  },
};

/**
 * NT-04 홈 팝업 배너 크기 프리셋 → 모달 최대 너비 className.
 * 편집 미리보기와 실제 노출(home-popup-banner)에서 공통 사용.
 */
export const NOTICE_POPUP_SIZE_META: Record<
  NoticePopupSize,
  { label: string; maxWidth: string }
> = {
  small: { label: '소', maxWidth: 'max-w-sm' },
  medium: { label: '중', maxWidth: 'max-w-md' },
  large: { label: '대', maxWidth: 'max-w-2xl' },
  // 와이드: 1200px 고정. 뷰포트가 좁으면 max-w-[95vw]가 우선 적용되어 자동 축소.
  wide: { label: '1200', maxWidth: 'max-w-[min(1200px,95vw)]' },
  // 원본: 프리셋 너비를 강제하지 않고 이미지 원본 크기 그대로(뷰포트 95% 한도). 모달이 width:fit 처리.
  original: { label: '원본', maxWidth: 'max-w-[95vw]' },
};
