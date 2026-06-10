/**
 * LandingFooter — Figma 시안 공용 푸터 (패밀리 링크 3카드 · 약관 · 카피라이트).
 * 다크(#2A3038) 배경. 전 시안 페이지 공유.
 */

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

const FAMILY_LINKS = [
  { title: 'OA PMS', desc: '호텔 통합 운영 솔루션', href: '#' },
  { title: 'OA Chatbot', desc: 'AI 호텔 상담 챗봇', href: '#' },
  { title: 'OA Blog', desc: '제품 소식·운영 노하우', href: '#' },
];

export function LandingFooter() {
  return (
    <footer className="bg-[#2A3038] px-5 py-10">
      <div className="mx-auto flex max-w-[1200px] flex-col items-center gap-6">
        <ul className="grid w-full max-w-[778px] grid-cols-1 gap-3 sm:grid-cols-3">
          {FAMILY_LINKS.map((f) => (
            <li key={f.title}>
              <Link
                href={f.href}
                className="group flex items-center justify-between rounded-lg bg-white/[0.06] px-5 py-4 transition-colors hover:bg-white/10"
              >
                <span className="flex flex-col">
                  <span className="text-base font-bold text-white">{f.title}</span>
                  <span className="text-xs text-white/70">{f.desc}</span>
                </span>
                <ArrowRight className="h-5 w-5 text-white/60 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </li>
          ))}
        </ul>

        <div className="flex w-full flex-col items-center gap-4 border-t border-white/10 pt-6">
          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-white/80">
            <Link href="/landing/terms" className="hover:text-white">이용약관</Link>
            <span className="text-white/40">·</span>
            <Link href="/landing/privacy" className="hover:text-white">개인정보처리방침</Link>
            <span className="text-white/40">·</span>
            <Link href="/landing/status" className="hover:text-white">서비스 상태</Link>
            <span className="text-white/40">·</span>
            <Link href="/landing/notices" className="hover:text-white">공지/업데이트</Link>
          </div>
          <p className="text-sm text-white/60">© OATECH. All Rights Reserved.</p>
        </div>
      </div>
    </footer>
  );
}
