/**
 * `/tickets/[id]` — 호텔리어 티켓 상세 (IS-02, 시안 반영).
 *
 * 좌: 문의 상세(상세 내용·첨부) + 답변 내역(스레드/답변 폼).
 * 우: 진행 스테퍼(접수→처리중→답변 완료) + 문의 메타 카드.
 *
 * - 본인 또는 같은 호텔 티켓만 조회 가능 (`getTicketDetail`에서 권한 체크).
 * - internal_memo 메시지는 서버에서 자동 제외.
 * - completed 상태에선 답변 폼이 숨김.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Check, CheckCircle2, Paperclip } from 'lucide-react';
import { MarkdownView } from '@/components/articles/markdown-view';
import { requireAuth } from '@/lib/permissions';
import {
  getTicketDetail,
  getFeedback,
  loadCategoryLabelMaps,
} from '@/lib/services/tickets';
import { URGENCY_LABEL } from '@/lib/services/tickets-meta';
import { AttachmentList } from '@/components/tickets/attachment-list';
import { FeedbackWidget } from './_components/feedback-widget';
import type { TicketStatus } from '@/db/schema';
import { TicketThread } from './_components/ticket-thread';
import { ReplyForm } from './_components/reply-form';

export const dynamic = 'force-dynamic';

type RouteParams = Promise<{ id: string }>;
type SearchParams = Promise<{ created?: string }>;

const CURRENT_INDEX: Record<TicketStatus, number> = {
  received: 0,
  in_progress: 1,
  completed: 2,
};

const ACTIVE_COLOR: Record<TicketStatus, string> = {
  received: 'bg-[#217CF9]',
  in_progress: 'bg-[#8969EA]',
  completed: 'bg-[#00A36B]',
};

export async function generateMetadata({ params }: { params: RouteParams }) {
  const { id } = await params;
  const user = await requireAuth();
  const ticket = await getTicketDetail(id, {
    id: user.id,
    role: user.role,
    hotelId: user.hotelId,
  });
  return {
    title: ticket ? `${ticket.ticketNo} — ${ticket.title}` : '문의 상세',
  };
}

function fmtDate(d: Date | string | null): string {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
}

export default async function HotelierTicketDetailPage({
  params,
  searchParams,
}: {
  params: RouteParams;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const justCreated = sp.created === '1';

  const user = await requireAuth();
  const [ticket, labels] = await Promise.all([
    getTicketDetail(id, {
      id: user.id,
      role: user.role,
      hotelId: user.hotelId,
    }),
    loadCategoryLabelMaps(),
  ]);

  const showFeedback =
    ticket?.status === 'completed' && ticket?.reporterId === user.id;
  const existingFeedback = showFeedback ? await getFeedback(id) : null;

  if (!ticket) {
    notFound();
  }

  const productLabel = labels.product[ticket.productCode] ?? ticket.productCode;
  const issueTypeLabel = labels.issueType[ticket.issueType] ?? ticket.issueType;

  const replies = ticket.messages.filter((m) => m.kind === 'public');
  const lastPublicAt =
    replies.length > 0 ? replies[replies.length - 1].createdAt : null;

  const currentIndex = CURRENT_INDEX[ticket.status];
  const steps: { label: string; date: string }[] = [
    { label: '접수', date: fmtDate(ticket.createdAt) },
    {
      label: '처리중',
      date:
        ticket.status === 'received'
          ? '대기'
          : ticket.status === 'completed'
            ? '처리 완료'
            : '진행중',
    },
    {
      label: '답변 완료',
      date: ticket.status === 'completed' ? fmtDate(lastPublicAt) : '대기',
    },
  ];

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      {/* 상단 */}
      <Link
        href="/tickets"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-[#555D6D] hover:text-[#00A36B] dark:text-slate-300"
      >
        <ArrowLeft className="h-4 w-4" />
        문의 내역으로
      </Link>
      <p className="font-mono text-sm text-[#868B94] dark:text-slate-400">
        {ticket.ticketNo}
      </p>
      <h1 className="mb-6 text-3xl font-bold text-[#1A1C20] dark:text-white">
        {ticket.title}
      </h1>

      {justCreated && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-800 dark:bg-emerald-950/30">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
          <div className="flex-1 text-sm">
            <div className="font-semibold text-emerald-800 dark:text-emerald-200">
              문의가 정상 접수되었습니다
            </div>
            <p className="mt-0.5 text-emerald-700/80 dark:text-emerald-300/80">
              선택하신 연락수단으로 접수 확인 알림이 발송됩니다. 진행 상태는 이
              페이지에서 확인하실 수 있습니다.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* 좌측 본문 */}
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          {/* 문의 상세 */}
          <section className="flex flex-col gap-5 rounded-xl border border-black/[0.06] bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-base font-bold text-[#1A1C20] dark:text-white">
              문의 상세
            </h2>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-[#555D6D] dark:text-slate-300">
                상세 내용
              </span>
              <div className="rounded-lg bg-[#F7F8F9] p-4 dark:bg-slate-800/60">
                <MarkdownView source={ticket.content} className="text-sm" />
              </div>
            </div>

            {ticket.attachments.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="flex items-center gap-1.5 text-sm font-medium text-[#555D6D] dark:text-slate-300">
                  <Paperclip className="h-3.5 w-3.5" />
                  첨부 파일 {ticket.attachments.length}개
                </span>
                <AttachmentList
                  attachments={ticket.attachments.map((a) => ({
                    id: a.id,
                    originalName: a.originalName,
                    mimeType: a.mimeType,
                    sizeBytes: a.sizeBytes,
                  }))}
                />
              </div>
            )}
          </section>

          {/* 답변 내역 */}
          <section className="flex flex-col gap-4 rounded-xl border border-black/[0.06] bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-base font-bold text-[#1A1C20] dark:text-white">
              답변 내역
            </h2>
            {replies.length > 0 ? (
              <TicketThread
                messages={ticket.messages.map((m) => ({
                  id: m.id,
                  kind: m.kind,
                  content: m.content,
                  authorName: m.authorName,
                  authorRole: m.authorRole,
                  createdAt: m.createdAt,
                  metadata: m.metadata,
                }))}
                showInternalMemo={false}
              />
            ) : (
              <div className="flex items-center justify-center rounded-lg bg-[#F7F8F9] py-16 text-sm text-[#868B94] dark:bg-slate-800/60 dark:text-slate-400">
                아직 답변이 없습니다.
              </div>
            )}

            {/* 답변 보완 — 접수(received) 단계에서만 */}
            {ticket.status === 'received' ? (
              <div className="border-t border-black/[0.06] pt-4 dark:border-slate-800">
                <div className="mb-3 text-sm font-medium text-[#555D6D] dark:text-slate-300">
                  답변 보완
                </div>
                <ReplyForm ticketId={ticket.id} />
              </div>
            ) : ticket.status === 'completed' ? (
              <div className="rounded-md border border-dashed border-slate-300 bg-slate-50/40 px-4 py-4 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
                완료된 문의입니다. 추가 문의는 신규 접수해주세요.
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-slate-300 bg-slate-50/40 px-4 py-4 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
                운영팀이 처리 중입니다. 처리 상황은 이 페이지에서 확인하실 수
                있습니다.
              </div>
            )}
          </section>

          {showFeedback && (
            <FeedbackWidget
              ticketId={ticket.id}
              ticketNo={ticket.ticketNo}
              existing={
                existingFeedback
                  ? {
                      rating: existingFeedback.rating,
                      comment: existingFeedback.comment,
                      createdAt: existingFeedback.createdAt.toISOString(),
                    }
                  : null
              }
            />
          )}
        </div>

        {/* 우측 사이드바 */}
        <aside className="flex shrink-0 flex-col gap-4 lg:w-[300px]">
          {/* 진행 스테퍼 */}
          <div className="rounded-xl border border-black/[0.06] bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <ol className="flex flex-col">
              {steps.map((step, i) => {
                const done = i < currentIndex;
                const active = i === currentIndex;
                const last = i === steps.length - 1;
                return (
                  <li key={i} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${
                          done
                            ? 'bg-[#00A36B]'
                            : active
                              ? ACTIVE_COLOR[ticket.status]
                              : 'bg-[#DCDEE3]'
                        }`}
                      >
                        {done ? <Check className="h-4 w-4" /> : i + 1}
                      </span>
                      {!last && (
                        <span
                          className={`my-1 w-px flex-1 ${done ? 'bg-[#00A36B]' : 'bg-[#DCDEE3]'}`}
                        />
                      )}
                    </div>
                    <div className={`flex flex-col ${last ? 'pb-0' : 'pb-6'}`}>
                      <span
                        className={`text-sm font-semibold ${
                          done || active
                            ? 'text-[#1A1C20] dark:text-slate-100'
                            : 'text-[#B0B3BA]'
                        }`}
                      >
                        {step.label}
                      </span>
                      <span className="text-xs text-[#868B94] dark:text-slate-400">
                        {step.date}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>

          {/* 메타 정보 */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-5 rounded-xl border border-black/[0.06] bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <Meta label="문의 프로그램" value={productLabel} />
            <Meta label="유형" value={issueTypeLabel} />
            <Meta label="접수자" value={ticket.reporterName ?? '-'} />
            <Meta label="호텔" value={ticket.hotelName ?? '미매핑'} />
            <Meta
              label="긴급도"
              value={URGENCY_LABEL[ticket.urgency] ?? ticket.urgency}
            />
            <Meta label="담당자" value={ticket.assigneeName ?? '-'} />
          </div>
        </aside>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-[#868B94] dark:text-slate-400">{label}</span>
      <span className="text-sm font-medium text-[#1A1C20] dark:text-slate-100">
        {value}
      </span>
    </div>
  );
}
