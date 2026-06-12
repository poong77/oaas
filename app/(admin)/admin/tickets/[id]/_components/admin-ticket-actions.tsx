'use client';

/**
 * 매니저 사이드바 액션 — 상태/담당자/마감일 변경 + Dev 에스컬레이션.
 */

import { useRouter } from 'next/navigation';
import { Fragment, useState, useTransition, type FormEvent } from 'react';
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Send,
  ShieldAlert,
  UserPen,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useConfirmDialog } from '@/components/dialogs/confirm-dialog';
import {
  assignTicketAction,
  changeStatusAction,
  escalateToDevAction,
} from '@/app/actions/ticket-actions';
import type { TicketStatus } from '@/db/schema';
import { STATUS_LABEL } from '@/lib/services/tickets-meta';
import { cn } from '@/lib/utils';

/** 상태 흐름(좌→우). 3단계 모두 노출, 어느 단계든 즉시 선택 가능. */
const STATUS_FLOW: TicketStatus[] = ['received', 'in_progress', 'completed'];

export function AdminTicketActions({
  ticketId,
  status,
  oneCallResolved = false,
  assigneeId,
  dueDate,
  managers,
  currentUserId,
}: {
  ticketId: string;
  status: TicketStatus;
  oneCallResolved?: boolean;
  assigneeId: string | null;
  dueDate: Date | string | null;
  managers: Array<{ id: string; name: string; role: string }>;
  currentUserId: string;
}) {
  const router = useRouter();
  const confirm = useConfirmDialog();
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<{
    tone: 'success' | 'error';
    text: string;
  } | null>(null);

  const [localStatus, setLocalStatus] = useState<TicketStatus>(status);
  const [oneCall, setOneCall] = useState<boolean>(oneCallResolved);
  const [localAssignee, setLocalAssignee] = useState<string>(assigneeId ?? '');
  const [localDue, setLocalDue] = useState<string>(
    dueDate ? new Date(dueDate).toISOString().slice(0, 16) : '',
  );

  function notifyOk(msg: string) {
    setNotice({ tone: 'success', text: msg });
    setTimeout(() => setNotice(null), 3500);
  }
  function notifyErr(msg: string) {
    setNotice({ tone: 'error', text: msg });
  }

  const statusChanged = localStatus !== status;
  const oneCallChanged =
    localStatus === 'completed' && oneCall !== oneCallResolved;

  function applyStatus() {
    if (!statusChanged && !oneCallChanged) return;
    const fd = new FormData();
    fd.append('ticketId', ticketId);
    fd.append('nextStatus', localStatus);
    if (localStatus === 'completed') {
      fd.append('oneCallResolved', oneCall ? 'true' : 'false');
    }
    startTransition(async () => {
      if (statusChanged) {
        const ok = await confirm({
          title: `상태를 "${STATUS_LABEL[localStatus]}"(으)로 변경할까요?`,
          description:
            localStatus === 'in_progress' || localStatus === 'completed'
              ? '선택한 연락수단으로 호텔리어에게 알림이 자동 발송됩니다.'
              : undefined,
          confirmText: '변경',
        });
        if (!ok) {
          setLocalStatus(status);
          return;
        }
      }
      const result = await changeStatusAction(fd);
      if (result.ok) {
        notifyOk(
          statusChanged
            ? `상태가 ${STATUS_LABEL[localStatus]}(으)로 변경되었습니다.`
            : '원콜 해결 여부가 저장되었습니다.',
        );
        router.refresh();
      } else {
        notifyErr(result.message ?? '변경에 실패했습니다');
        setLocalStatus(status);
      }
    });
  }

  function applyAssignment() {
    const fd = new FormData();
    fd.append('ticketId', ticketId);
    if (localAssignee) fd.append('assigneeId', localAssignee);
    if (localDue) fd.append('dueDate', new Date(localDue).toISOString());
    startTransition(async () => {
      const result = await assignTicketAction(fd);
      if (result.ok) {
        notifyOk('담당자·마감일이 저장되었습니다.');
        router.refresh();
      } else {
        notifyErr(result.message ?? '저장 실패');
      }
    });
  }

  /** datetime-local 입력 포맷(YYYY-MM-DDTHH:mm)의 '현재 로컬 시각'. */
  function nowLocalInputValue(): string {
    const d = new Date();
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  }

  /** 빠른 액션 — 마감일을 '지금'으로 설정하고 즉시 저장. */
  function setDueNow() {
    const now = nowLocalInputValue();
    setLocalDue(now);
    const fd = new FormData();
    fd.append('ticketId', ticketId);
    if (localAssignee) fd.append('assigneeId', localAssignee);
    fd.append('dueDate', new Date(now).toISOString());
    startTransition(async () => {
      const result = await assignTicketAction(fd);
      if (result.ok) {
        notifyOk('마감일이 지금으로 설정되었습니다.');
        router.refresh();
      } else {
        notifyErr(result.message ?? '저장 실패');
      }
    });
  }

  function takeOver() {
    setLocalAssignee(currentUserId);
    const fd = new FormData();
    fd.append('ticketId', ticketId);
    fd.append('assigneeId', currentUserId);
    if (localDue) fd.append('dueDate', new Date(localDue).toISOString());
    startTransition(async () => {
      const result = await assignTicketAction(fd);
      if (result.ok) {
        notifyOk('내가 담당으로 지정되었습니다.');
        router.refresh();
      } else {
        notifyErr(result.message ?? '저장 실패');
      }
    });
  }

  // Dev 에스컬
  const [escalateReason, setEscalateReason] = useState('');
  function escalate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (escalateReason.trim().length < 10) {
      notifyErr('Dev 팀에 전달할 사유를 10자 이상 적어주세요');
      return;
    }
    const fd = new FormData();
    fd.append('ticketId', ticketId);
    fd.append('reason', escalateReason.trim());
    startTransition(async () => {
      const ok = await confirm({
        title: 'Dev 팀에 에스컬레이션할까요?',
        description: 'Slack #dev-escalation 채널로 발송되며, 내부 메모에 이력이 기록됩니다.',
        confirmText: '발송',
      });
      if (!ok) return;
      const result = await escalateToDevAction(fd);
      if (result.ok) {
        notifyOk('Dev 채널로 발송되었습니다.');
        setEscalateReason('');
        router.refresh();
      } else {
        notifyErr(result.message ?? '발송 실패');
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {notice && (
        <div
          className={
            notice.tone === 'success'
              ? 'flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300'
              : 'flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300'
          }
        >
          {notice.tone === 'success' ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span>{notice.text}</span>
        </div>
      )}

      {/* 상태 변경 */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              상태
            </div>
            <span className="text-[11px] text-slate-400 dark:text-slate-500">
              현재: {STATUS_LABEL[status]}
            </span>
          </div>
          {/* 4단계 플로우 — 모두 노출, 어느 단계든 클릭하여 선택 */}
          <div className="flex items-stretch">
            {STATUS_FLOW.map((s, i) => {
              const selected = localStatus === s;
              const isCurrent = status === s;
              return (
                <Fragment key={s}>
                  <button
                    type="button"
                    onClick={() => setLocalStatus(s)}
                    disabled={pending}
                    aria-pressed={selected}
                    title={isCurrent ? '현재 상태' : `${STATUS_LABEL[s]}(으)로 변경`}
                    className={cn(
                      'flex-1 rounded-md border px-1.5 py-2 text-center text-xs font-semibold transition disabled:opacity-60',
                      selected
                        ? 'border-brand-600 bg-brand-600 text-white shadow-sm'
                        : isCurrent
                          ? 'border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-800 dark:bg-brand-950/40 dark:text-brand-300'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:bg-brand-50/60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-brand-700',
                    )}
                  >
                    {STATUS_LABEL[s]}
                  </button>
                  {i < STATUS_FLOW.length - 1 && (
                    <ChevronRight
                      className="h-4 w-4 shrink-0 self-center text-slate-300 dark:text-slate-600"
                      aria-hidden
                    />
                  )}
                </Fragment>
              );
            })}
          </div>
          {localStatus === 'completed' && (
            <label className="flex items-start gap-2 rounded-md border border-slate-200 bg-slate-50/60 p-2.5 text-sm dark:border-slate-800 dark:bg-slate-900/40">
              <input
                type="checkbox"
                checked={oneCall}
                onChange={(e) => setOneCall(e.target.checked)}
                disabled={pending}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-400"
              />
              <span>
                <span className="font-medium text-slate-700 dark:text-slate-200">
                  원콜 해결
                </span>
                <span className="ml-1 text-xs text-slate-500">
                  1회 작업으로 해결 (대시보드 원콜완료 지표에 집계)
                </span>
              </span>
            </label>
          )}
          <Button
            type="button"
            onClick={applyStatus}
            disabled={pending || (!statusChanged && !oneCallChanged)}
            size="sm"
          >
            상태 변경
          </Button>
        </CardContent>
      </Card>

      {/* 담당자 / 마감일 */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            담당 · 마감일
          </div>
          {/* 담당자 + '내가 담당' (드롭다운 옆 — 동선 최적화) */}
          <div className="flex items-center gap-2">
            <Select
              value={localAssignee}
              onChange={(e) => setLocalAssignee(e.target.value)}
              disabled={pending}
              className="min-w-0 flex-1"
            >
              <option value="">미배정</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.role === 'admin' ? '어드민' : '매니저'})
                  {m.id === currentUserId ? ' · 나' : ''}
                </option>
              ))}
            </Select>
            {localAssignee !== currentUserId && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={takeOver}
                disabled={pending}
                className="shrink-0"
              >
                <UserPen className="h-4 w-4" />
                내가 담당
              </Button>
            )}
          </div>
          {/* 마감일 + '지금 마감' (일시선택바 옆 — 동선 최적화) */}
          <div className="flex items-center gap-2">
            <Input
              type="datetime-local"
              value={localDue}
              onChange={(e) => setLocalDue(e.target.value)}
              disabled={pending}
              className="min-w-0 flex-1"
            />
            <button
              type="button"
              onClick={setDueNow}
              disabled={pending}
              className="inline-flex shrink-0 items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs font-medium text-amber-700 transition hover:bg-amber-100 disabled:opacity-60 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-950/70"
            >
              <CalendarClock className="h-3.5 w-3.5" />
              지금 마감
            </button>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={applyAssignment}
            disabled={pending}
            className="w-fit"
          >
            저장
          </Button>
        </CardContent>
      </Card>

      {/* Dev 에스컬 */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-4">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <ShieldAlert className="h-3.5 w-3.5" />
            Dev 에스컬레이션
          </div>
          <form onSubmit={escalate} className="flex flex-col gap-2">
            <Textarea
              value={escalateReason}
              onChange={(e) => setEscalateReason(e.target.value)}
              placeholder="개발팀에게 전달할 컨텍스트·재현 단계·로그 위치 등"
              rows={4}
              disabled={pending}
            />
            <Button
              type="submit"
              variant="outline"
              size="sm"
              disabled={pending || escalateReason.trim().length < 10}
            >
              <Send className="h-4 w-4" />
              Slack #dev-escalation
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
