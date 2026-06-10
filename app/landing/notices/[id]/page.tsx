/**
 * /landing/notices/[id] — 공지 상세 시안.
 *
 * 공용 헤더(authed)/푸터 + 배지·제목·날짜 + 본문 + 목록으로 돌아가기.
 * 시안 데이터(landing-notices-data)에서 id로 조회.
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { LandingHeader } from '../../_components/landing-header';
import { LandingFooter } from '../../_components/landing-footer';
import {
  getLandingNotice,
  NOTICE_BADGE,
} from '../../_components/landing-notices-data';

export const metadata = { title: '공지사항 — OA서포트' };

export default async function LandingNoticeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const notice = getLandingNotice(parseInt(id, 10));
  if (!notice) notFound();

  return (
    <div className="min-h-screen bg-white font-sans text-[#1A1C20]">
      <LandingHeader variant="authed" />

      <main className="mx-auto max-w-[800px] px-5 py-10">
        <Link
          href="/landing/notices"
          className="mb-5 inline-flex items-center gap-1 text-sm text-[#868B94] hover:text-[#1A1C20]"
        >
          <ArrowLeft className="h-4 w-4" />
          공지사항
        </Link>

        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${NOTICE_BADGE[notice.type]}`}
          >
            {notice.type}
          </span>
          <span className="text-xs text-[#B0B3BA]">{notice.date}</span>
        </div>

        <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-[28px]">
          {notice.title}
        </h1>

        <div className="mt-6 flex flex-col gap-3 border-t border-[#E5E7EB] pt-6">
          {notice.body.map((p, i) => (
            <p key={i} className="text-sm leading-relaxed text-[#3F4651]">
              {p}
            </p>
          ))}
        </div>

        <div className="mt-10">
          <Link
            href="/landing/notices"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#DCDEE3] px-4 py-2.5 text-sm font-medium text-[#1A1C20] transition-colors hover:bg-[#F7F8F9]"
          >
            <ArrowLeft className="h-4 w-4" />
            목록으로
          </Link>
        </div>
      </main>

      <LandingFooter />
    </div>
  );
}
