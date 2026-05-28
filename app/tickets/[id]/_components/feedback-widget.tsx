'use client';

/**
 * ⑦ 호텔리어 피드백 위젯 (Phase 6).
 *
 * 표시 조건:
 *   - 티켓 status === 'completed'
 *   - viewer가 ticket.reporter 인 경우 (page 레벨에서 이미 필터링됨)
 *
 * 상태:
 *   - 미제출: 라디오 3개 + 코멘트 textarea + 제출 버튼
 *   - 제출됨: 현재 평가 + 코멘트 표시 + "수정" 버튼 → 다시 폼 모드
 *   - 미해결 평가일 때: 재접수 링크 노출
 */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition, type FormEvent } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  PencilLine,
  Send,
  ThumbsUp,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { submitFeedbackAction } from '@/app/actions/ticket-actions';
import { RATING_LABEL, RATING_TONE } from '@/lib/services/tickets-meta';
import type { TicketFeedbackRating } from '@/db/schema';

const RATING_OPTIONS: Array<{
  value: TicketFeedbackRating;
  label: string;
  hint: string;
}> = [
  {
    value: 'resolved',
    label: '해결됨',
    hint: '문제가 모두 해결되었어요',
  },
  {
    value: 'partial',
    label: '일부 해결',
    hint: '일부만 해결되었거나 임시방편이에요',
  },
  {
    value: 'unresolved',
    label: '미해결',
    hint: '아직 해결되지 않았어요',
  },
];

export function FeedbackWidget({
  ticketId,
  ticketNo,
  existing,
}: {
  ticketId: string;
  ticketNo: string;
  existing: {
    rating: TicketFeedbackRating;
    comment: string | null;
    createdAt: string;
  } | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<boolean>(existing === null);
  const [rating, setRating] = useState<TicketFeedbackRating | null>(
    existing?.rating ?? null,
  );
  const [comment, setComment] = useState<string>(existing?.comment ?? '');
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<{
    tone: 'success' | 'error';
    text: string;
  } | null>(null);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!rating) {
      setNotice({ tone: 'error', text: '평가를 선택해주세요.' });
      return;
    }
    const fd = new FormData();
    fd.append('ticketId', ticketId);
    fd.append('rating', rating);
    if (comment.trim()) fd.append('comment', comment.trim());
    startTransition(async () => {
      const result = await submitFeedbackAction(fd);
      if (result.ok) {
        setNotice({
          tone: 'success',
          text: '평가가 저장되었습니다. 소중한 의견 감사합니다!',
        });
        setEditing(false);
        router.refresh();
      } else {
        setNotice({
          tone: 'error',
          text: result.message ?? '저장에 실패했습니다.',
        });
      }
    });
  }

  // 제출 완료 상태 — 결과 카드
  if (!editing && existing) {
    return (
      <Card className="border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20">
        <CardContent className="flex flex-col gap-3 p-5">
          <div className="flex items-center gap-2">
            <ThumbsUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
              내 평가
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge tone={RATING_TONE[existing.rating]}>
              {RATING_LABEL[existing.rating]}
            </Badge>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              평가를 남겨주셨습니다
            </span>
          </div>
          {existing.comment && (
            <div className="whitespace-pre-wrap rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
              {existing.comment}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setEditing(true)}
            >
              <PencilLine className="h-4 w-4" />
              평가 수정
            </Button>
            {existing.rating === 'unresolved' && (
              <Button asChild size="sm" variant="outline">
                <Link
                  href={`/tickets/new?from=ticket&ticket=${encodeURIComponent(ticketNo)}`}
                >
                  재접수 도움 받기
                </Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // 입력 폼
  return (
    <Card className="border-brand-200 dark:border-brand-900">
      <CardContent className="flex flex-col gap-3 p-5">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-300">
          <ThumbsUp className="h-3.5 w-3.5" />
          이번 답변이 도움이 되셨나요?
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          평가를 남기시면 답변 품질을 더 개선할 수 있습니다.
        </p>

        {notice && (
          <div
            role="status"
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

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <fieldset>
            <legend className="sr-only">평가 선택</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {RATING_OPTIONS.map((opt) => {
                const checked = rating === opt.value;
                return (
                  <label
                    key={opt.value}
                    className={cn(
                      'flex cursor-pointer flex-col gap-1 rounded-md border p-3 text-sm transition-colors',
                      checked
                        ? 'border-brand-400 bg-brand-50 dark:border-brand-600 dark:bg-brand-950/30'
                        : 'border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600',
                    )}
                  >
                    <input
                      type="radio"
                      name="rating"
                      value={opt.value}
                      checked={checked}
                      onChange={() => setRating(opt.value)}
                      className="sr-only"
                    />
                    <span className="flex items-center gap-1.5 font-medium">
                      <Badge tone={RATING_TONE[opt.value]}>{opt.label}</Badge>
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {opt.hint}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div>
            <label
              htmlFor="feedback-comment"
              className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300"
            >
              코멘트 (선택)
            </label>
            <Textarea
              id="feedback-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="추가로 남기실 의견이 있으면 적어주세요"
              rows={3}
              maxLength={2000}
              disabled={pending}
            />
            <div className="mt-1 text-right text-[11px] text-slate-400">
              {comment.length} / 2000
            </div>
          </div>

          {rating === 'unresolved' && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              평가가 미해결인 경우, 제출 후 신규 티켓으로 다시 접수하실 수
              있습니다.
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="submit"
              size="sm"
              disabled={pending || !rating}
            >
              <Send className="h-4 w-4" />
              {existing ? '평가 수정 저장' : '평가 제출'}
            </Button>
            {existing && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditing(false);
                  setRating(existing.rating);
                  setComment(existing.comment ?? '');
                  setNotice(null);
                }}
                disabled={pending}
              >
                취소
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
