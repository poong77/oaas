/**
 * /landing/tickets — 문의 내역 목록 시안.
 *
 * 구성: 인증 헤더 + 상태 필터·검색·테이블(모바일 카드뷰)·페이지네이션 + 공용 푸터.
 * 자체 헤더를 가진 독립 시안. 공개 접근: /landing 하위 공개 규칙.
 */
import { LandingHeader } from '../_components/landing-header';
import { LandingFooter } from '../_components/landing-footer';
import { TicketsListView } from '../_components/tickets-list-view';

export const metadata = {
  title: '문의 내역 — OA서포트',
};

export default function LandingTicketsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white font-sans text-[#1A1C20]">
      <LandingHeader variant="authed" />
      <main className="flex-1 px-5 py-12 sm:py-16">
        <TicketsListView />
      </main>
      <LandingFooter />
    </div>
  );
}
