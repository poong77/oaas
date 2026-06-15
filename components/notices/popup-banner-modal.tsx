'use client';

/**
 * NT-04 홈 팝업 배너 모달 (프레젠테이션).
 *
 * 편집 미리보기(notice-editor)와 실제 노출(home-popup-banner) 양쪽에서 공용.
 * 데이터 fetch/localStorage 등 부수효과는 호출부가 담당하고,
 * 이 컴포넌트는 "보여주기"만 책임진다.
 *
 * z-index: 80 (EmergencyBanner z-50, ImageUploadDialog z-60 위)
 */

import Link from 'next/link';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { NoticePopupSize } from '@/db/schema';
import { NOTICE_POPUP_SIZE_META } from '@/lib/services/notices-meta';

export interface PopupBannerModalProps {
  imageUrl: string;
  size: NoticePopupSize;
  title: string;
  /** 원본 px 치수 — 있으면 <img>에 부여해 로드 전 레이아웃 공간 예약(CLS 방지) */
  width?: number | null;
  height?: number | null;
  /** 이미지 클릭 시 이동할 경로. null이면 클릭 비활성 (미리보기) */
  href?: string | null;
  onClose: () => void;
  /** 제공 시 "오늘 하루 안 보기" 버튼 노출 (실제 노출에서만) */
  onDismissToday?: () => void;
  /** 미리보기 모드 — 좌상단 라벨 표시 + 클릭 이동 없음 */
  preview?: boolean;
}

export function PopupBannerModal({
  imageUrl,
  size,
  title,
  width,
  height,
  href,
  onClose,
  onDismissToday,
  preview = false,
}: PopupBannerModalProps) {
  const maxWidth = NOTICE_POPUP_SIZE_META[size].maxWidth;
  // 치수를 알면 width/height 부여 → 브라우저가 종횡비로 공간 예약(CLS 0). 레거시 행은 미부여(기존 동작).
  const hasDims = Boolean(width && height);
  // 원본 크기: 프리셋 너비로 늘리지 않고 이미지 본래 크기 그대로(뷰포트 한도 내 자동 축소).
  const isOriginal = size === 'original';

  const image = (
    // 외부(Blob) 이미지이므로 next/image 대신 img 사용
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imageUrl}
      alt={title}
      className={cn(
        'h-auto select-none rounded-t-lg object-contain',
        // 원본: 본래 너비(컨테이너 한도 내). 프리셋: 컨테이너 가득 채움.
        isOriginal ? 'w-auto max-w-full' : 'w-full',
      )}
      draggable={false}
      // CLS 완화: 종횡비 공간 예약 + 디코딩을 메인 스레드에서 분리
      width={hasDims ? (width as number) : undefined}
      height={hasDims ? (height as number) : undefined}
      style={hasDims ? { aspectRatio: `${width} / ${height}` } : undefined}
      decoding="async"
    />
  );

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className={cn(
          'relative overflow-hidden rounded-lg bg-white shadow-2xl dark:bg-slate-900',
          // 원본: 이미지 크기에 맞춰 컨테이너가 줄어들도록 width:fit. 프리셋: 가득 채움.
          isOriginal ? 'w-fit' : 'w-full',
          maxWidth,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {preview && (
          <span className="absolute left-2 top-2 z-10 rounded bg-black/60 px-2 py-0.5 text-xs font-medium text-white">
            미리보기
          </span>
        )}

        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="absolute right-2 top-2 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white transition hover:bg-black/70"
        >
          <X className="h-4 w-4" />
        </button>

        {href && !preview ? (
          <Link href={href} onClick={onClose} className="block">
            {image}
          </Link>
        ) : (
          image
        )}

        {(onDismissToday || !preview) && (
          <div className="flex items-center justify-between gap-2 border-t border-slate-200 px-4 py-2.5 text-sm dark:border-slate-700">
            {onDismissToday ? (
              <button
                type="button"
                onClick={onDismissToday}
                className="text-slate-500 transition hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                오늘 하루 보지 않기
              </button>
            ) : (
              <span className="text-slate-400">미리보기 — 실제 노출 시 ‘오늘 하루 보지 않기’ 제공</span>
            )}
            <button
              type="button"
              onClick={onClose}
              className="font-medium text-slate-700 transition hover:text-slate-900 dark:text-slate-200 dark:hover:text-white"
            >
              닫기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
