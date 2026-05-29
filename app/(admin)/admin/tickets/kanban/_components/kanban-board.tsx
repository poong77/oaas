'use client';

/**
 * IS-04 칸반 보드 (Phase 6).
 *
 * 동작:
 *   - 4개 컬럼 (received / in_progress / on_hold / completed)
 *   - HTML5 native DnD API (라이브러리 없음)
 *   - drop 즉시 optimistic update → moveTicketStatusAction → 실패 시 rollback
 *   - 모바일: 가로 스크롤 + 카드 하단 fallback select (터치 DnD 한계 회피)
 *
 * Server-only chain 차단: 이 컴포넌트는 `lib/services/tickets-meta.ts` 만 import.
 */

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  useEffect,
  useMemo,
  useState,
  useTransition,
  type DragEvent,
} from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Flame,
  Hash,
  UserCircle2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { moveTicketStatusAction } from '@/app/actions/ticket-actions';
import {
  KANBAN_COLUMN_ORDER,
  KANBAN_COLUMN_TONE,
  STATUS_LABEL,
  URGENCY_LABEL,
  URGENCY_TONE,
} from '@/lib/services/tickets-meta';
import type { TicketStatus } from '@/db/schema';

export type KanbanCard = {
  id: string;
  ticketNo: string;
  title: string;
  productCode: string;
  urgency: string;
  status: TicketStatus;
  createdAt: string | Date;
  dueDate: string | Date | null;
  assigneeId: string | null;
  assigneeName: string | null;
  hotelId: string | null;
  hotelName: string | null;
};

type Columns = Record<TicketStatus, KanbanCard[]>;

function truncate(s: string, n = 60): string {
  if (!s) return '';
  return s.length <= n ? s : `${s.slice(0, n - 1)}…`;
}

function relativeKo(d: string | Date | null | undefined): string {
  if (!d) return '-';
  const date = new Date(d).getTime();
  const now = Date.now();
  const diffMin = Math.round((now - date) / 60000);
  if (diffMin < 1) return '방금 전';
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `${diffH}시간 전`;
  const diffD = Math.round(diffH / 24);
  if (diffD < 30) return `${diffD}일 전`;
  return new Date(d).toLocaleDateString('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'short',
    day: 'numeric',
  });
}

function initials(name: string | null): string {
  if (!name) return '?';
  const trimmed = name.trim();
  if (!trimmed) return '?';
  // 한글 이름은 마지막 2자, 영문은 첫 자 2개
  const isHangul = /[가-힯]/.test(trimmed);
  if (isHangul) return trimmed.slice(-2);
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return trimmed.slice(0, 2).toUpperCase();
}

function isDueSoon(due: string | Date | null): boolean {
  if (!due) return false;
  const now = Date.now();
  const t = new Date(due).getTime();
  // 24h 이내(이미 지난 것 포함)면 강조
  return t - now < 24 * 60 * 60 * 1000;
}

export function KanbanBoard({ initial }: { initial: Columns }) {
  const router = useRouter();
  const [columns, setColumns] = useState<Columns>(initial);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<TicketStatus | null>(null);
  const [, startTransition] = useTransition();
  const [notice, setNotice] = useState<{
    tone: 'success' | 'error';
    text: string;
  } | null>(null);

  // 서버 데이터 갱신 시 동기화
  useEffect(() => {
    setColumns(initial);
  }, [initial]);

  function showNotice(tone: 'success' | 'error', text: string) {
    setNotice({ tone, text });
    window.setTimeout(() => setNotice(null), 3500);
  }

  function moveCardLocal(
    cardId: string,
    from: TicketStatus,
    to: TicketStatus,
  ): { reverted: boolean; card?: KanbanCard } {
    let movedCard: KanbanCard | undefined;
    setColumns((prev) => {
      const fromList = prev[from] ?? [];
      const idx = fromList.findIndex((c) => c.id === cardId);
      if (idx === -1) return prev;
      movedCard = { ...fromList[idx], status: to };
      const nextFrom = [...fromList.slice(0, idx), ...fromList.slice(idx + 1)];
      const nextTo = [movedCard, ...(prev[to] ?? [])];
      return { ...prev, [from]: nextFrom, [to]: nextTo };
    });
    return { reverted: false, card: movedCard };
  }

  function rollbackCard(cardId: string, originalStatus: TicketStatus) {
    setColumns((prev) => {
      // 전체에서 찾아 origin으로 복귀
      const all = Object.values(prev).flat();
      const card = all.find((c) => c.id === cardId);
      if (!card) return prev;
      const cleaned: Columns = {
        received: prev.received.filter((c) => c.id !== cardId),
        in_progress: prev.in_progress.filter((c) => c.id !== cardId),
        on_hold: prev.on_hold.filter((c) => c.id !== cardId),
        completed: prev.completed.filter((c) => c.id !== cardId),
      };
      const restored: KanbanCard = { ...card, status: originalStatus };
      cleaned[originalStatus] = [restored, ...cleaned[originalStatus]];
      return cleaned;
    });
  }

  function handleDragStart(e: DragEvent<HTMLDivElement>, card: KanbanCard) {
    e.dataTransfer.setData('text/plain', card.id);
    e.dataTransfer.effectAllowed = 'move';
    setDraggingId(card.id);
  }

  function handleDragEnd() {
    setDraggingId(null);
    setDragOverCol(null);
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>, col: TicketStatus) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverCol !== col) setDragOverCol(col);
  }

  function handleDragLeave(col: TicketStatus) {
    if (dragOverCol === col) setDragOverCol(null);
  }

  function performMove(cardId: string, to: TicketStatus) {
    // 현재 컬럼 찾기
    let from: TicketStatus | null = null;
    for (const status of KANBAN_COLUMN_ORDER) {
      if (columns[status].some((c) => c.id === cardId)) {
        from = status;
        break;
      }
    }
    if (!from || from === to) return;

    // optimistic move
    moveCardLocal(cardId, from, to);

    const fd = new FormData();
    fd.append('ticketId', cardId);
    fd.append('nextStatus', to);

    startTransition(async () => {
      const result = await moveTicketStatusAction(fd);
      if (result.ok) {
        showNotice(
          'success',
          `상태가 "${STATUS_LABEL[to]}"(으)로 변경되었습니다. 호텔리어에게 알림이 발송됩니다.`,
        );
        router.refresh();
      } else {
        rollbackCard(cardId, from!);
        showNotice('error', result.message ?? '상태 변경에 실패했습니다.');
      }
    });
  }

  function handleDrop(e: DragEvent<HTMLDivElement>, to: TicketStatus) {
    e.preventDefault();
    setDragOverCol(null);
    setDraggingId(null);
    const cardId = e.dataTransfer.getData('text/plain');
    if (!cardId) return;
    performMove(cardId, to);
  }

  const totalCount = useMemo(
    () => Object.values(columns).reduce((s, l) => s + l.length, 0),
    [columns],
  );

  return (
    <div className="flex flex-col gap-3">
      {notice && (
        <div
          className={
            notice.tone === 'success'
              ? 'flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300'
              : 'flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300'
          }
          role="status"
        >
          {notice.tone === 'success' ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span>{notice.text}</span>
        </div>
      )}

      <div className="text-xs text-slate-500 dark:text-slate-400">
        총 {totalCount}건 표시 중 · 완료 컬럼은 최근 30일만 노출됩니다 ·
        카드를 드래그해서 상태를 변경하세요.
      </div>

      <div
        className="grid snap-x snap-mandatory grid-flow-col gap-3 overflow-x-auto pb-2 sm:grid-flow-row sm:auto-cols-fr sm:grid-cols-4 sm:snap-none"
        aria-label="티켓 칸반"
      >
        {KANBAN_COLUMN_ORDER.map((status) => {
          const list = columns[status] ?? [];
          const isOver = dragOverCol === status;
          return (
            <div
              key={status}
              className={cn(
                'flex w-[82vw] min-w-[260px] shrink-0 snap-start flex-col gap-2 rounded-lg border bg-slate-50/50 p-2 transition-colors dark:bg-slate-900/40 sm:w-auto',
                isOver
                  ? 'border-brand-400 bg-brand-50/60 dark:border-brand-600 dark:bg-brand-950/30'
                  : 'border-slate-200 dark:border-slate-800',
              )}
              onDragOver={(e) => handleDragOver(e, status)}
              onDragLeave={() => handleDragLeave(status)}
              onDrop={(e) => handleDrop(e, status)}
            >
              <div className="flex items-center justify-between px-1.5 py-0.5">
                <Badge tone={KANBAN_COLUMN_TONE[status]}>
                  {STATUS_LABEL[status]}
                </Badge>
                <span className="text-xs font-semibold tabular-nums text-slate-500 dark:text-slate-400">
                  {list.length}
                </span>
              </div>

              <div className="flex flex-col gap-2">
                {list.length === 0 && (
                  <div className="rounded-md border border-dashed border-slate-200 px-2 py-6 text-center text-xs text-slate-400 dark:border-slate-700">
                    카드 없음
                  </div>
                )}
                {list.map((card) => (
                  <KanbanCardView
                    key={card.id}
                    card={card}
                    isDragging={draggingId === card.id}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onMoveFallback={(toStatus) =>
                      performMove(card.id, toStatus)
                    }
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function KanbanCardView({
  card,
  isDragging,
  onDragStart,
  onDragEnd,
  onMoveFallback,
}: {
  card: KanbanCard;
  isDragging: boolean;
  onDragStart: (e: DragEvent<HTMLDivElement>, card: KanbanCard) => void;
  onDragEnd: () => void;
  onMoveFallback: (to: TicketStatus) => void;
}) {
  const urgencyTone = URGENCY_TONE[card.urgency] ?? 'slate';
  const urgencyLabel = URGENCY_LABEL[card.urgency] ?? card.urgency.toUpperCase();
  const dueSoon = card.dueDate ? isDueSoon(card.dueDate) : false;

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, card)}
      onDragEnd={onDragEnd}
      className={cn(
        'transition-opacity',
        isDragging && 'opacity-50',
      )}
    >
      <Card className="cursor-grab active:cursor-grabbing">
        <CardContent className="flex flex-col gap-1.5 p-2.5">
          <div className="flex items-center justify-between gap-1.5">
            <Link
              href={`/admin/tickets/${card.id}`}
              className="inline-flex items-center gap-1 font-mono text-[11px] text-brand-600 hover:underline dark:text-brand-400"
            >
              <Hash className="h-3 w-3" />
              {card.ticketNo}
            </Link>
            <Badge tone={urgencyTone}>
              {card.urgency === 'p1' && <Flame className="h-3 w-3" />}
              {urgencyLabel}
            </Badge>
          </div>
          <Link
            href={`/admin/tickets/${card.id}`}
            className="text-sm font-semibold leading-snug text-slate-900 hover:underline dark:text-slate-100"
          >
            {truncate(card.title, 60)}
          </Link>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {card.hotelName ?? '미매핑 호텔'}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {relativeKo(card.createdAt)}
            </span>
            <span className="inline-flex items-center gap-1">
              {card.assigneeName ? (
                <span
                  className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-100 text-[10px] font-bold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300"
                  title={card.assigneeName}
                >
                  {initials(card.assigneeName)}
                </span>
              ) : (
                <>
                  <UserCircle2 className="h-3 w-3" />
                  <span>미배정</span>
                </>
              )}
            </span>
            {card.dueDate && (
              <span
                className={cn(
                  'inline-flex items-center gap-1',
                  dueSoon
                    ? 'font-medium text-red-600 dark:text-red-400'
                    : 'text-slate-500 dark:text-slate-400',
                )}
              >
                ⏰ {relativeKo(card.dueDate).replace(/^/, '마감 ')}
              </span>
            )}
          </div>

          {/* 모바일 fallback: 터치 환경에서 DnD가 어려우므로 select 노출 */}
          <div className="mt-1 sm:hidden">
            <label className="sr-only" htmlFor={`mv-${card.id}`}>
              다른 상태로 이동
            </label>
            <Select
              id={`mv-${card.id}`}
              value={card.status}
              onChange={(e) => {
                const next = e.target.value as TicketStatus;
                if (next !== card.status) onMoveFallback(next);
              }}
              className="h-7 text-xs"
            >
              {KANBAN_COLUMN_ORDER.map((s) => (
                <option key={s} value={s}>
                  ⇄ {STATUS_LABEL[s]}로 이동
                </option>
              ))}
            </Select>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
