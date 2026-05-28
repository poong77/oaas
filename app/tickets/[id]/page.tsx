/**
 * `/tickets/[id]` — 호텔리어 티켓 상세 (IS-02).
 *
 * - 본인 또는 같은 호텔 티켓만 조회 가능 (`getTicketDetail`에서 권한 체크).
 * - internal_memo 메시지는 서버에서 자동 제외.
 * - completed 상태에선 답변 폼이 숨김.
 *
 * 매니저/어드민도 본인 호텔이 아니면 본인 접수일 때만 보임. 전체 큐는 `/admin/tickets/[id]`.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  Hash,
  ListChecks,
  Paperclip,
  UserCircle2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { MarkdownView } from '@/components/articles/markdown-view';
import { requireAuth } from '@/lib/permissions';
import {
  STATUS_LABEL,
  getTicketDetail,
  loadCategoryLabelMaps,
} from '@/lib/services/tickets';
import type { TicketStatus } from '@/db/schema';
import { TicketThread } from './_components/ticket-thread';
import { ReplyForm } from './_components/reply-form';

export const dynamic = 'force-dynamic';

type RouteParams = Promise<{ id: string }>;
type SearchParams = Promise<{ created?: string }>;

const STATUS_TONE: Record<TicketStatus, 'slate' | 'brand' | 'warn' | 'success'> = {
  received: 'brand',
  in_progress: 'warn',
  on_hold: 'slate',
  completed: 'success',
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
    title: ticket ? `${ticket.ticketNo} — ${ticket.title}` : '티켓 상세',
  };
}

function fmtDateTime(d: Date | string | null): string {
  if (!d) return '-';
  const date = new Date(d);
  return date.toLocaleString('ko-KR', {
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

  if (!ticket) {
    notFound();
  }

  const productLabel = labels.product[ticket.productCode] ?? ticket.productCode;
  const issueTypeLabel =
    labels.issueType[ticket.issueType] ?? ticket.issueType;
  const urgencyLabel = labels.urgency[ticket.urgency] ?? ticket.urgency;
  const impactLabel = ticket.impactScope
    ? (labels.impact[ticket.impactScope] ?? ticket.impactScope)
    : null;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <PageHeader
        breadcrumb={
          <Link
            href="/tickets"
            className="inline-flex items-center gap-1 hover:underline"
          >
            <ArrowLeft className="h-3 w-3" />
            내 문의로
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
          </span>
        }
      />

      {justCreated && (
        <Card className="border-emerald-200 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-950/30">
          <CardContent className="flex items-start gap-3 p-4">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
            <div className="flex-1 text-sm">
              <div className="font-semibold text-emerald-800 dark:text-emerald-200">
                티켓이 정상 접수되었습니다
              </div>
              <p className="mt-0.5 text-emerald-700/80 dark:text-emerald-300/80">
                선택하신 연락수단으로 접수 확인 알림이 발송됩니다. 운영팀이
                확인 후 답변드리며, 진행 상태는 이 페이지에서 실시간으로
                업데이트됩니다.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 메타 */}
      <Card>
        <CardContent className="grid gap-3 p-5 sm:grid-cols-2">
          <MetaRow
            icon={<Building2 className="h-3.5 w-3.5" />}
            label="호텔"
            value={ticket.hotelName ?? '미매핑'}
          />
          <MetaRow
            icon={<UserCircle2 className="h-3.5 w-3.5" />}
            label="접수자"
            value={ticket.reporterName ?? '-'}
          />
          <MetaRow
            icon={<Calendar className="h-3.5 w-3.5" />}
            label="접수 일시"
            value={fmtDateTime(ticket.createdAt)}
          />
          <MetaRow
            icon={<UserCircle2 className="h-3.5 w-3.5" />}
            label="담당자"
            value={ticket.assigneeName ?? '미배정'}
          />
          {ticket.dueDate && (
            <MetaRow
              icon={<Clock className="h-3.5 w-3.5" />}
              label="처리 예정"
              value={fmtDateTime(ticket.dueDate)}
            />
          )}
          <MetaRow
            icon={<ListChecks className="h-3.5 w-3.5" />}
            label="유입 채널"
            value={
              ticket.channel === 'phone'
                ? '전화'
                : ticket.channel === 'chatbot'
                  ? '챗봇'
                  : '웹'
            }
          />
        </CardContent>
      </Card>

      {/* 본문 */}
      <Card>
        <CardContent className="p-5">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            내용
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
                    href={a.blobUrl}
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
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            처리 이력 및 답변
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
            showInternalMemo={false}
          />
        </CardContent>
      </Card>

      {/* 답변 폼 */}
      <Card>
        <CardContent className="p-5">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            추가 답변
          </div>
          <ReplyForm
            ticketId={ticket.id}
            disabled={ticket.status === 'completed'}
            disabledReason={
              ticket.status === 'completed'
                ? '완료된 티켓입니다. 추가 문의는 신규 접수해주세요.'
                : undefined
            }
          />
        </CardContent>
      </Card>

      {ticket.status === 'completed' && (
        <div className="flex justify-end">
          <Button asChild variant="outline" size="sm">
            <Link href="/tickets/new">신규 접수</Link>
          </Button>
        </div>
      )}
    </div>
  );
}

function MetaRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="mt-0.5 text-slate-400">{icon}</span>
      <span className="min-w-[80px] text-slate-500 dark:text-slate-400">
        {label}
      </span>
      <span className="font-medium text-slate-800 dark:text-slate-100">
        {value}
      </span>
    </div>
  );
}
