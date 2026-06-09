'use client';

/**
 * SMS 미리보기 패널.
 *
 * - 마크다운 본문을 plain text로 변환 → 길이 카운터 + LMS 안내
 * - 매니저 답변 화면에서 "이 본문이 SMS로 나가면 어떻게 보일까" 참고용
 *
 * 정책:
 *   - SMS: 90자 (한글 기준, 솔라피 SMS 표준)
 *   - LMS: 91자~2,000자 (한글)
 *   - MMS: 91자~2,000자 + 첨부
 *   - 단, 본 패널은 길이 산정만. 실제 발송은 알림 템플릿(notification_templates) 기반.
 */

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { markdownToPlain } from '@/lib/editor/markdown-to-plain';

interface SmsPreviewProps {
  /** 마크다운 본문 */
  source: string;
  /** 기본 펼침 여부 (기본 false — 토글로 열기) */
  defaultOpen?: boolean;
  className?: string;
}

const SMS_THRESHOLD = 90; // 솔라피 한글 SMS 한도
const LMS_THRESHOLD = 2000; // LMS/MMS 한도

export function SmsPreview({ source, defaultOpen = false, className }: SmsPreviewProps) {
  const [open, setOpen] = useState(defaultOpen);

  const plain = useMemo(() => markdownToPlain(source), [source]);
  const len = plain.length;

  let level: 'empty' | 'sms' | 'lms' | 'over' = 'empty';
  if (len > 0 && len <= SMS_THRESHOLD) level = 'sms';
  else if (len > SMS_THRESHOLD && len <= LMS_THRESHOLD) level = 'lms';
  else if (len > LMS_THRESHOLD) level = 'over';

  const levelClass: Record<typeof level, string> = {
    empty: 'text-slate-400 dark:text-slate-500',
    sms: 'text-emerald-700 dark:text-emerald-400',
    lms: 'text-amber-700 dark:text-amber-400',
    over: 'text-rose-700 dark:text-rose-400',
  };

  const levelLabel: Record<typeof level, string> = {
    empty: '미입력',
    sms: 'SMS 가능',
    lms: 'LMS로 발송 (요금 ↑)',
    over: '길이 초과 — 잘릴 수 있음',
  };

  return (
    <div
      className={cn(
        'rounded-md border border-slate-200 dark:border-slate-700',
        className,
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
        aria-expanded={open}
      >
        <span className="inline-flex items-center gap-1.5">
          {open ? (
            <ChevronDown className="h-3 w-3" aria-hidden />
          ) : (
            <ChevronRight className="h-3 w-3" aria-hidden />
          )}
          <MessageSquare className="h-3 w-3" aria-hidden />
          SMS 발송 시 미리보기 (참고용)
        </span>
        <span className={cn('inline-flex items-center gap-2 font-medium', levelClass[level])}>
          <span className="font-mono">{len}자</span>
          <span>· {levelLabel[level]}</span>
        </span>
      </button>
      {open && (
        <div className="border-t border-slate-200 p-3 dark:border-slate-700">
          {len === 0 ? (
            <p className="text-xs text-slate-400 dark:text-slate-500">
              본문을 입력하면 SMS 형태로 변환된 결과가 표시됩니다.
            </p>
          ) : (
            <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded bg-slate-50 p-2 text-xs text-slate-800 dark:bg-slate-900 dark:text-slate-200">
              {plain}
            </pre>
          )}
          <p className="mt-2 text-[10px] text-slate-500 dark:text-slate-400">
            ⚠ 실제 SMS는 메시지 템플릿(`/admin/master/message-templates`) 기반으로 발송됩니다. 본 미리보기는 본문 길이·내용 참고용입니다.
          </p>
        </div>
      )}
    </div>
  );
}
