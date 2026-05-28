/**
 * LP-01 ⑨ 푸터 — 회사명·긴급 전화문의·약관·카피라이트.
 *
 * "긴급 전화문의"는 모바일에서도 강조되도록 별도 카드로 노출.
 */

import Link from 'next/link';
import { PhoneCall } from 'lucide-react';

const EMERGENCY_PHONE = '02-0000-0000'; // TODO(phase-2-temp): 실제 OA AS 전화번호로 교체

export function HomeFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white py-10 dark:border-slate-800 dark:bg-slate-950">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          {/* 긴급 전화문의 */}
          <a
            href={`tel:${EMERGENCY_PHONE.replace(/[^0-9+]/g, '')}`}
            className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 transition-colors hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/30 dark:hover:bg-red-900/40"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-red-600 text-white shadow-sm">
              <PhoneCall className="h-5 w-5" />
            </span>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-medium uppercase tracking-wider text-red-700 dark:text-red-300">
                긴급 전화 문의
              </span>
              <span className="text-base font-bold text-red-900 dark:text-red-100">
                {EMERGENCY_PHONE}
              </span>
              <span className="text-xs text-red-800/80 dark:text-red-200/80">
                업무 시간 외 긴급 상황 시 이용하세요.
              </span>
            </div>
          </a>

          {/* 회사 안내 */}
          <div className="flex flex-col justify-center gap-1.5 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
              OA Solutions
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              OA PMS · CMS · Keyless · 키오스크 · 웹서비스 통합 운영
            </span>
          </div>
        </div>

        <div className="flex flex-col items-start gap-3 border-t border-slate-200 pt-5 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between">
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
            <span className="opacity-70">이용약관</span>
            <span className="opacity-70">개인정보 처리방침</span>
          </div>
          <span className="opacity-70">
            © {new Date().getFullYear()} OA Solutions. All rights reserved.
          </span>
        </div>
      </div>
    </footer>
  );
}
