'use client';

/**
 * FAQ 도움됨 위젯 (Phase 4 단순화).
 *
 * - localStorage(`faqVoted:{id}`)로 1회 차단
 * - 카운터만 +1 (DB에 user 매핑 안 함, Phase 6+ 강화)
 */

import { useEffect, useState, useTransition } from 'react';
import { ThumbsDown, ThumbsUp } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { submitFaqHelpfulAction } from '@/app/actions/faq-actions';

const KEY_PREFIX = 'faqVoted:';

export function FaqHelpfulWidget({
  faqId,
  initialYes,
  initialNo,
}: {
  faqId: string;
  initialYes: number;
  initialNo: number;
}) {
  const [yes, setYes] = useState(initialYes);
  const [no, setNo] = useState(initialNo);
  const [voted, setVoted] = useState<null | 'yes' | 'no'>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    try {
      const v = localStorage.getItem(`${KEY_PREFIX}${faqId}`);
      if (v === 'yes' || v === 'no') setVoted(v);
    } catch {
      // localStorage 불가 (private mode 등) — 무시
    }
  }, [faqId]);

  function vote(helpful: boolean) {
    if (voted) return;
    startTransition(async () => {
      const res = await submitFaqHelpfulAction({ faqId, helpful });
      if (res.ok) {
        if (typeof res.helpfulYes === 'number') setYes(res.helpfulYes);
        if (typeof res.helpfulNo === 'number') setNo(res.helpfulNo);
        setVoted(helpful ? 'yes' : 'no');
        try {
          localStorage.setItem(
            `${KEY_PREFIX}${faqId}`,
            helpful ? 'yes' : 'no',
          );
        } catch {
          // 무시
        }
        toast.success(
          helpful ? '도움이 되었다니 다행입니다!' : '피드백 감사합니다.',
        );
      } else {
        toast.error(res.message ?? '저장 실패');
      }
    });
  }

  const total = yes + no;
  const yesPct = total > 0 ? Math.round((yes / total) * 100) : null;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3 text-xs dark:border-slate-800">
      <span className="text-slate-500 dark:text-slate-400">
        이 FAQ가 도움이 되었나요?
        {yesPct !== null && (
          <span className="ml-1 text-slate-400">
            ({total}명 중 {yesPct}%)
          </span>
        )}
      </span>
      <div className="flex gap-1">
        <Button
          type="button"
          size="sm"
          variant={voted === 'yes' ? 'default' : 'outline'}
          disabled={pending || voted !== null}
          onClick={() => vote(true)}
        >
          <ThumbsUp className="h-3 w-3" />
          <span>{yes}</span>
        </Button>
        <Button
          type="button"
          size="sm"
          variant={voted === 'no' ? 'destructive' : 'outline'}
          disabled={pending || voted !== null}
          onClick={() => vote(false)}
        >
          <ThumbsDown className="h-3 w-3" />
          <span>{no}</span>
        </Button>
      </div>
      {voted && (
        <span className="text-emerald-600 dark:text-emerald-400">
          피드백을 남겨주셔서 감사합니다
        </span>
      )}
    </div>
  );
}
