/**
 * /landing/tickets/[id] — 문의 상세 시안.
 *
 * 상태별 미리보기: ?status=received|progress|hold|done (기본 done).
 * 구성: 인증 헤더 + 상세(스테퍼·메타·첨부·보류 배너·답변) + 공용 푸터.
 */
import { LandingHeader } from '../../_components/landing-header';
import { LandingFooter } from '../../_components/landing-footer';
import { TicketDetailView, type TicketStatus } from '../../_components/ticket-detail-view';

export const metadata = {
  title: '문의 상세 — OA서포트',
};

const VALID: TicketStatus[] = ['received', 'progress', 'hold', 'done'];

export default async function LandingTicketDetailPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const status: TicketStatus = VALID.includes(sp.status as TicketStatus)
    ? (sp.status as TicketStatus)
    : 'done';

  return (
    <div className="flex min-h-screen flex-col bg-white font-sans text-[#1A1C20]">
      <LandingHeader variant="authed" />
      <main className="flex-1 px-5 py-12 sm:py-16">
        <TicketDetailView status={status} />
      </main>
      <LandingFooter />
    </div>
  );
}
