/**
 * `/admin/tickets/[id]` — 매니저+어드민 티켓 처리 페이지 (IS-04, IC-07, IC-08).
 *
 * 좌측 메인: 메타·본문·첨부·메시지 타임라인 (internal_memo 포함)·답변 폼
 * 우측 사이드: 상태/담당/마감일·Dev 에스컬·요약
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
  Building2,
  Calendar,
  ExternalLink,
  Hash,
  Mail,
  MessageSquare,
  Paperclip,
  Phone,
  UserCircle2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { MarkdownView } from '@/components/articles/markdown-view';
import { requireRole } from '@/lib/permissions';
import {
  STATUS_LABEL,
  getTicketDetail,
  getFeedback,
  listAssignableManagers,
  loadCategoryLabelMaps,
} from '@/lib/services/tickets';
import { getAllTicketChannelsMap } from '@/lib/services/master-ticket-channels';
import { getTicketAssist } from '@/lib/services/ticket-assist';
import { listActiveModels, getDefaultModel } from '@/lib/services/ai-models';
import { getChannelDisplay } from '@/lib/ticket-channel-label';
import { RATING_LABEL, RATING_TONE } from '@/lib/services/tickets-meta';
import type { TicketStatus } from '@/db/schema';
import { TicketThread } from '@/app/tickets/[id]/_components/ticket-thread';
import { AdminTicketActions } from './_components/admin-ticket-actions';
import { AdminReplyForm } from './_components/admin-reply-form';

export const dynamic = 'force-dynamic';

type RouteParams = Promise<{ id: string }>;

const STATUS_TONE: Record<TicketStatus, 'slate' | 'brand' | 'warn' | 'success'> = {
  received: 'brand',
  in_progress: 'warn',
  on_hold: 'slate',
  completed: 'success',
};

export async function generateMetadata({ params }: { params: RouteParams }) {
  const { id } = await params;
  const user = await requireRole(['manager', 'admin']);
  const ticket = await getTicketDetail(id, {
    id: user.id,
    role: user.role,
    hotelId: user.hotelId,
  });
  return {
    title: ticket
      ? `[처리] ${ticket.ticketNo} — ${ticket.title}`
      : '티켓 처리',
  };
}

function fmtDateTime(d: Date | string | null): string {
  if (!d) return '-';
  const date = new Date(d);
  return date.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default async function AdminTicketDetailPage({
  params,
}: {
  params: RouteParams;
}) {
  const { id } = await params;
  const user = await requireRole(['manager', 'admin']);

  const [
    ticket,
    labels,
    managers,
    feedback,
    channelMap,
    assist,
    aiModels,
    defaultModel,
  ] = await Promise.all([
    getTicketDetail(id, {
      id: user.id,
      role: user.role,
      hotelId: user.hotelId,
    }),
    loadCategoryLabelMaps(),
    listAssignableManagers(),
    getFeedback(id),
    getAllTicketChannelsMap(),
    getTicketAssist(id),
    listActiveModels(),
    getDefaultModel(),
  ]);

  if (!ticket) {
    notFound();
  }

  // 직렬화 안전 형태로 매핑(Date 제외) — 클라이언트 폼에 전달
  const assistModels = aiModels.map((m) => ({
    id: m.id,
    provider: m.provider,
    code: m.code,
    label: m.label,
    description: m.description,
    tier: m.tier,
    isDefault: m.isDefault,
  }));

  const productLabel = labels.product[ticket.productCode] ?? ticket.productCode;
  const issueTypeLabel =
    labels.issueType[ticket.issueType] ?? ticket.issueType;
  const urgencyLabel = labels.urgency[ticket.urgency] ?? ticket.urgency;
  const impactLabel = ticket.impactScope
    ? (labels.impact[ticket.impactScope] ?? ticket.impactScope)
    : null;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        breadcrumb={
          <Link
            href="/admin/tickets"
            className="inline-flex items-center gap-1 hover:underline"
          >
            <ArrowLeft className="h-3 w-3" />
            문의 관리로
          </Link>
        }
        title={
          <span className="inline-flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs font-mono text-slate-500 dark:text-slate-400">
              <Hash className="h-3 w-3" />
              {ticket.ticketNo}
            </span>
            <Badge tone={STATUS_TONE[ticket.status]}>
              {STATUS_LABEL[ticket.status]}
            </Badge>
            <span>{ticket.title}</span>
            {ticket.urgency === 'p1' && (
              <Badge tone="danger">P1 긴급</Badge>
            )}
          </span>
        }
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <span>{productLabel}</span>·<span>{issueTypeLabel}</span>·
            <span>긴급도 {urgencyLabel}</span>
            {impactLabel && (
              <>
                ·<span>영향범위 {impactLabel}</span>
              </>
            )}
            ·<span>채널 {getChannelDisplay(ticket.channel, channelMap).label}</span>
          </span>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* 좌측 메인 */}
        <div className="flex flex-col gap-4 lg:col-span-2">
          {/* 본문 */}
          <Card>
            <CardContent className="p-5">
              <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                접수 내용
              </div>
              <MarkdownView source={ticket.content} className="text-sm" />
            </CardContent>
          </Card>

          {/* 첨부 */}
          {ticket.attachments.length > 0 && (
            <Card>
              <CardContent className="p-5">
                <div className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  <Paperclip className="h-3.5 w-3.5" />
                  첨부 {ticket.attachments.length}개
                </div>
                <ul className="flex flex-col gap-1.5">
                  {ticket.attachments.map((a) => (
                    <li key={a.id}>
                      <a
                        href={`/api/attachments/${a.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm text-brand-600 hover:underline dark:text-brand-400"
                      >
                        <Paperclip className="h-3.5 w-3.5" />
                        {a.originalName}
                        <span className="text-xs text-slate-400">
                          ({formatBytes(a.sizeBytes)})
                        </span>
                        <ExternalLink className="h-3 w-3 text-slate-400" />
                      </a>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* 스레드 */}
          <Card>
            <CardContent className="flex flex-col gap-4 p-5">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <MessageSquare className="h-3.5 w-3.5" />
                처리 이력 · 답변 · 메모
              </div>
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
                showInternalMemo
              />
            </CardContent>
          </Card>

          {/* 답변 폼 */}
          <Card>
            <CardContent className="p-5">
              <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                답변 / 메모 작성
              </div>
              <AdminReplyForm
                ticketId={ticket.id}
                assist={assist}
                models={assistModels}
                defaultModelId={defaultModel?.id ?? null}
              />
            </CardContent>
          </Card>
        </div>

        {/* 우측 사이드 */}
        <div className="flex flex-col gap-3">
          {/* 메타 카드 */}
          <Card>
            <CardContent className="flex flex-col gap-2 p-4 text-sm">
              <SideRow
                icon={<Building2 className="h-3.5 w-3.5" />}
                label="호텔"
                value={ticket.hotelName ?? '미매핑'}
              />
              <SideRow
                icon={<UserCircle2 className="h-3.5 w-3.5" />}
                label="접수자"
                value={ticket.reporterName ?? '-'}
              />
              {ticket.reporterEmail && (
                <SideRow
                  icon={<Mail className="h-3.5 w-3.5" />}
                  label="이메일"
                  value={ticket.reporterEmail}
                />
              )}
              {ticket.reporterPhone && (
                <SideRow
                  icon={<Phone className="h-3.5 w-3.5" />}
                  label="연락처"
                  value={ticket.reporterPhone}
                />
              )}
              <SideRow
                icon={<Calendar className="h-3.5 w-3.5" />}
                label="접수일"
                value={fmtDateTime(ticket.createdAt)}
              />
              <SideRow
                icon={<MessageSquare className="h-3.5 w-3.5" />}
                label="연락방법"
                value={
                  (ticket.contactMethods ?? []).length > 0
                    ? (ticket.contactMethods ?? [])
                        .map((m) => (m === 'sms' ? 'SMS' : '이메일'))
                        .join(', ')
                    : '미선택'
                }
              />
            </CardContent>
          </Card>

          {feedback && (
            <Card className="border-emerald-200 bg-emerald-50/40 dark:border-emerald-900 dark:bg-emerald-950/20">
              <CardContent className="flex flex-col gap-2 p-4">
                <span className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                  호텔리어 피드백
                </span>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge tone={RATING_TONE[feedback.rating]}>
                    {RATING_LABEL[feedback.rating]}
                  </Badge>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {fmtDateTime(feedback.createdAt)}
                  </span>
                </div>
                {feedback.comment && (
                  <p className="whitespace-pre-wrap rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                    {feedback.comment}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          <AdminTicketActions
            ticketId={ticket.id}
            status={ticket.status}
            oneCallResolved={ticket.oneCallResolved}
            assigneeId={ticket.assigneeId}
            dueDate={ticket.dueDate}
            managers={managers.map((m) => ({
              id: m.id,
              name: m.name,
              role: m.role,
            }))}
            currentUserId={user.id}
          />
        </div>
      </div>
    </div>
  );
}

function SideRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 text-slate-400">{icon}</span>
      <span className="min-w-[60px] text-slate-500 dark:text-slate-400">
        {label}
      </span>
      <span className="flex-1 font-medium text-slate-800 dark:text-slate-100">
        {value}
      </span>
    </div>
  );
}
