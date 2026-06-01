/**
 * SiteFooter — 어드민 외 모든 프론트 페이지 최하단에 노출되는 글로벌 푸터.
 *
 * 노출 정책은 RoleScope에서 결정 (Header와 동일 — !isAdminArea).
 * 콘텐츠는 OA 패밀리(아웃링크) + 약관/정책/외부 링크/카피라이트.
 */

import Link from 'next/link';
import { ExternalLink } from 'lucide-react';

// OA 패밀리 — 외부 서비스 아웃링크 (2026-06-01 추가).
const OA_FAMILY = [
  {
    label: 'OA PMS',
    host: 'www.oapms.com',
    href: 'https://www.oapms.com',
    desc: '호텔 통합 운영 솔루션',
  },
  {
    label: 'OA Chat',
    host: 'oachat.ai',
    href: 'https://oachat.ai',
    desc: 'AI 호텔 상담 챗봇',
  },
  {
    label: 'OA Blog',
    host: 'blog.oapms.com',
    href: 'https://blog.oapms.com',
    desc: '제품 소식·운영 노하우',
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-slate-200 bg-white py-6 dark:border-slate-800 dark:bg-slate-950">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* OA 패밀리 아웃링크 박스 (푸터 상단) */}
        <div className="mb-6 border-b border-slate-100 pb-6 dark:border-slate-800/60">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            OA 패밀리
          </h2>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {OA_FAMILY.map((s) => (
              <li key={s.host}>
                <a
                  href={s.href}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="group flex h-full items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3.5 transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:bg-white hover:shadow-sm dark:border-slate-800 dark:bg-slate-900/40 dark:hover:border-brand-700 dark:hover:bg-slate-900"
                >
                  <span className="flex flex-col gap-0.5">
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {s.label}
                      <span className="ml-1.5 text-xs font-normal text-slate-400">
                        {s.host}
                      </span>
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {s.desc}
                    </span>
                  </span>
                  <ExternalLink className="h-4 w-4 shrink-0 text-slate-400 transition-colors group-hover:text-brand-600 dark:group-hover:text-brand-400" />
                </a>
              </li>
            ))}
          </ul>
        </div>

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
            Copyright 2022(C) OA Tech. All Right Reserved.
          </span>
        </div>
      </div>
    </footer>
  );
}
