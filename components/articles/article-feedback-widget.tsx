'use client';

import { useState, useTransition } from 'react';
import { ThumbsDown, ThumbsUp } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { submitArticleFeedback } from '@/app/actions/article-actions';
import { cn } from '@/lib/utils';

/**
 * SS-03 도움됨 / 아니에요 피드백 위젯.
 *
 * 동작:
 *   - 비로그인도 제출 가능 (counter만 증가) — toast로 로그인 안내.
 *   - 로그인 사용자는 (articleId, userId) 1회 제약. 다시 클릭 시 변경.
 *   - "아니에요" 클릭 → optional comment textarea 노출.
 */
export function ArticleFeedbackWidget({
  articleId,
  initialYes,
  initialNo,
  isLoggedIn,
}: {
  articleId: string;
  initialYes: number;
  initialNo: number;
  isLoggedIn: boolean;
}) {
  const [yes, setYes] = useState(initialYes);
  const [no, setNo] = useState(initialNo);
  const [picked, setPicked] = useState<null | 'yes' | 'no'>(null);
  const [showCommentBox, setShowCommentBox] = useState(false);
  const [comment, setComment] = useState('');
  const [pending, startTransition] = useTransition();

  function submit(helpful: boolean) {
    startTransition(async () => {
      const res = await submitArticleFeedback({
        articleId,
        helpful,
        comment: helpful ? null : comment.trim() || null,
      });
      if (res.ok) {
        if (typeof res.helpfulYes === 'number') setYes(res.helpfulYes);
        if (typeof res.helpfulNo === 'number') setNo(res.helpfulNo);
        setPicked(helpful ? 'yes' : 'no');
        if (!res.loggedIn) {
          toast.info('로그인 후 의견을 남기면 다음에 수정할 수 있습니다.');
        } else {
          toast.success(
            helpful ? '도움이 되었다고 알려주셔서 감사합니다!' : '피드백 감사합니다. 개선에 반영하겠습니다.',
          );
        }
        if (!helpful) setShowCommentBox(true);
      } else {
        toast.error(res.message ?? '피드백 저장에 실패했습니다.');
      }
    });
  }

  const total = yes + no;
  const yesPct = total > 0 ? Math.round((yes / total) * 100) : null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold">이 문서가 도움이 되었나요?</h3>
          {yesPct !== null && (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              지금까지 {total}명 중 {yes}명({yesPct}%)이 도움이 되었다고 답했습니다.
            </p>
          )}
          {!isLoggedIn && (
            <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
              로그인하지 않은 경우, 의견을 수정/확인할 수 없습니다.
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant={picked === 'yes' ? 'default' : 'outline'}
            size="sm"
            disabled={pending}
            onClick={() => submit(true)}
            className={cn(picked === 'yes' && 'pointer-events-none')}
          >
            <ThumbsUp className="h-3.5 w-3.5" />
            <span>도움됐어요</span>
            <span className="ml-1 rounded bg-white/20 px-1.5 text-xs tabular-nums dark:bg-slate-700/40">
              {yes}
            </span>
          </Button>
          <Button
            type="button"
            variant={picked === 'no' ? 'destructive' : 'outline'}
            size="sm"
            disabled={pending}
            onClick={() => submit(false)}
          >
            <ThumbsDown className="h-3.5 w-3.5" />
            <span>아니에요</span>
            <span className="ml-1 rounded bg-white/20 px-1.5 text-xs tabular-nums dark:bg-slate-700/40">
              {no}
            </span>
          </Button>
        </div>
      </div>

      {showCommentBox && (
        <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-700">
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
            어떤 점이 아쉬웠나요? (선택)
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="개선이 필요한 부분을 알려주세요"
            className="mt-1 w-full rounded-md border border-slate-200 bg-white p-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-slate-700 dark:bg-slate-950"
          />
          <div className="mt-2 flex justify-end">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => submit(false)}
            >
              의견 보내기
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
