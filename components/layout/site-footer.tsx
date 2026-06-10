/**
 * SiteFooter — 어드민 외 모든 프론트 페이지 최하단 글로벌 푸터 (시안 다크, 2026-06-10).
 *
 * 노출 정책은 RoleScope에서 결정 (Header와 동일 — !isAdminArea).
 * 콘텐츠: OA 패밀리 아웃링크 3카드 + 약관/정책 링크 + 카피라이트 + 로고.
 */

import Link from 'next/link';
import { ExternalLink } from 'lucide-react';

const OA_FAMILY = [
  { label: 'OA PMS', href: 'https://www.oapms.com', desc: '호텔 통합 운영 솔루션' },
  { label: 'OA Chatbot', href: 'https://oachat.ai', desc: 'AI 호텔 상담 챗봇' },
  { label: 'OA Blog', href: 'https://blog.oapms.com', desc: '제품 소식·운영 노하우' },
];

export function SiteFooter() {
  return (
    <footer className="mt-auto bg-[#2A3038] px-5 py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-6">
        {/* OA 패밀리 */}
        <ul className="grid w-full max-w-[820px] grid-cols-1 gap-3 sm:grid-cols-3">
          {OA_FAMILY.map((s) => (
            <li key={s.label}>
              <a
                href={s.href}
                target="_blank"
                rel="noreferrer noopener"
                className="group flex items-center justify-between rounded-lg bg-white/[0.06] px-5 py-4 transition-colors hover:bg-white/10"
              >
                <span className="flex flex-col">
                  <span className="text-base font-bold text-white">{s.label}</span>
                  <span className="text-xs text-white/70">{s.desc}</span>
                </span>
                <ExternalLink className="h-4 w-4 shrink-0 text-white/60 transition-transform group-hover:translate-x-0.5" />
              </a>
            </li>
          ))}
        </ul>

        <div className="flex w-full flex-col items-center gap-3 border-t border-white/10 pt-6">
          <nav className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-white/80">
            <Link href="/terms" className="hover:text-white">이용약관</Link>
            <span className="text-white/40">·</span>
            <Link href="/privacy" className="hover:text-white">개인정보처리방침</Link>
            <span className="text-white/40">·</span>
            <Link href="/status" className="hover:text-white">서비스 상태</Link>
            <span className="text-white/40">·</span>
            <Link href="/notices" className="hover:text-white">공지/업데이트</Link>
          </nav>
          <p className="text-sm text-white/60">© OATECH. All Rights Reserved.</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/landing/logo-footer.svg"
            alt="OATECH"
            className="mt-1 h-5 w-auto opacity-40"
          />
        </div>
      </div>
    </footer>
  );
}
