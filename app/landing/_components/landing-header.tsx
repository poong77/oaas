'use client';

/**
 * LandingHeader — Figma 시안 공용 헤더 (로고 · 내비 · 운영중 배지 · 우측 액션).
 *
 * variant:
 *   - 'public'  : 미인증. 우측에 [로그인] 버튼.
 *   - 'authed'  : 인증. 내비에 '문의내역' 추가, 우측에 호텔명(아웃라인) 버튼.
 *
 * 전 시안 페이지가 동일 헤더를 재사용해 일관성을 보장한다.
 */

import Link from 'next/link';

type Variant = 'public' | 'authed';

const NAV_PUBLIC = [
  { label: '제품별 가이드', href: '/landing/help' },
  { label: '문의하기', href: '/landing/inquiry' },
  { label: '공지사항', href: '/landing/notices' },
];

const NAV_AUTHED = [
  { label: '제품별 가이드', href: '/landing/help' },
  { label: '문의하기', href: '/landing/inquiry' },
  { label: '문의내역', href: '/landing/tickets' },
  { label: '공지사항', href: '/landing/notices' },
];

export function LandingHeader({
  variant = 'public',
  hotelName = '오아호텔',
}: {
  variant?: Variant;
  hotelName?: string;
}) {
  const nav = variant === 'authed' ? NAV_AUTHED : NAV_PUBLIC;

  return (
    <header className="sticky top-0 z-50 border-b border-black/5 bg-white">
      <div className="mx-auto flex h-[68px] max-w-[1200px] items-center justify-between px-5">
        <Link href="/landing" className="flex items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/landing/logo-header.svg" alt="OA서포트" className="h-5 w-auto" />
        </Link>

        <nav className="flex items-center gap-3 sm:gap-6">
          <div className="hidden items-center gap-6 md:flex">
            {nav.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="text-sm font-medium text-[#1A1C20] hover:text-[#00A36B]"
              >
                {item.label}
              </Link>
            ))}
          </div>

          <span className="hidden items-center gap-1.5 rounded-full bg-[#E6F7F0] px-2.5 py-1 sm:inline-flex">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#008A59] opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#008A59]" />
            </span>
            <span className="text-xs font-semibold text-[#008A59]">운영 중</span>
          </span>

          {variant === 'authed' ? (
            <Link
              href="/landing/mypage"
              className="rounded-lg border border-black/[0.06] px-4 py-2 text-sm font-medium text-[#1A1C20] transition-colors hover:bg-[#F7F8F9]"
            >
              {hotelName}
            </Link>
          ) : (
            <Link
              href="/landing/login"
              className="rounded-lg bg-[#00A36B] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#008A59]"
            >
              로그인
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
