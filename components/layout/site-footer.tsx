/**
 * SiteFooter — 어드민 외 모든 프론트 페이지 최하단에 노출되는 글로벌 푸터.
 *
 * 노출 정책은 RoleScope에서 결정 (Header와 동일 — !isAdminArea).
 * 콘텐츠는 약관/정책/외부 링크/카피라이트 정도로 최소화.
 */

import Link from 'next/link';

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-slate-200 bg-white py-6 dark:border-slate-800 dark:bg-slate-950">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-start gap-3 text-xs text-slate-500 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <Link href="/notices" className="hover:underline">
              공지/업데이트
            </Link>
            <Link href="/status" className="hover:underline">
              서비스 상태
            </Link>
            <a
              href="https://oapms.com"
              target="_blank"
              rel="noreferrer noopener"
              className="hover:underline"
            >
              oapms.com
            </a>
            <Link href="/terms" className="hover:underline">
              이용약관
            </Link>
            <Link href="/privacy" className="hover:underline">
              개인정보 처리방침
            </Link>
          </div>
          <span className="opacity-70">
            © {year} OA Solutions. All rights reserved.
          </span>
        </div>
      </div>
    </footer>
  );
}
