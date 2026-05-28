'use client';

/**
 * 매니저 사이드바 액션 — 상태/담당자/마감일 변경 + Dev 에스컬레이션.
 */

import { useRouter } from 'next/navigation';
import { useState, useTransition, type FormEvent } from 'react';
import { AlertCircle, CheckCircle2, Send, ShieldAlert, UserPen } from 'lucide-react';
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

export function AdminTicketActions({
  ticketId,
  status,
  assigneeId,
  dueDate,
  managers,
  currentUserId,
}: {
  ticketId: string;
  status: TicketStatus;
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

  function applyStatus() {
    if (localStatus === status) return;
    const fd = new FormData();
    fd.append('ticketId', ticketId);
    fd.append('nextStatus', localStatus);
    startTransition(async () => {
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
      const result = await changeStatusAction(fd);
      if (result.ok) {
        notifyOk(`상태가 ${STATUS_LABEL[localStatus]}(으)로 변경되었습니다.`);
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
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            상태
          </div>
          <Select
            value={localStatus}
            onChange={(e) => setLocalStatus(e.target.value as TicketStatus)}
            disabled={pending}
          >
            <option value="received">접수</option>
            <option value="in_progress">처리중</option>
            <option value="on_hold">보류</option>
            <option value="completed">완료</option>
          </Select>
          <Button
            type="button"
            onClick={applyStatus}
            disabled={pending || localStatus === status}
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
          <Select
            value={localAssignee}
            onChange={(e) => setLocalAssignee(e.target.value)}
            disabled={pending}
          >
            <option value="">미배정</option>
            {managers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.role === 'admin' ? '어드민' : '매니저'})
                {m.id === currentUserId ? ' · 나' : ''}
              </option>
            ))}
          </Select>
          <Input
            type="datetime-local"
            value={localDue}
            onChange={(e) => setLocalDue(e.target.value)}
            disabled={pending}
          />
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              onClick={applyAssignment}
              disabled={pending}
            >
              저장
            </Button>
            {localAssignee !== currentUserId && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={takeOver}
                disabled={pending}
              >
                <UserPen className="h-4 w-4" />
                내가 담당
              </Button>
            )}
          </div>
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
