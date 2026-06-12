'use client';

/**
 * 역할 페이지 FAQ — 답변 열고/접기(아코디언).
 *
 * - `<details>` 기반 (SSR 안정, JS 없이도 동작)
 * - 답변은 MarkdownView로 렌더 (faq.answerMarkdown)
 * - 메인 FAQ 페이지(components/faqs/faq-accordion.tsx)와 동일한 시각 패턴
 */

import { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';
import { MarkdownView } from '@/components/articles/markdown-view';
import { cn } from '@/lib/utils';
import type { RoleStarterFaqCard } from '@/lib/services/master-role-starters';

export function RoleFaqList({ faqs }: { faqs: RoleStarterFaqCard[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {faqs.map((faq) => (
        <li key={faq.id} data-testid="role-faq-card">
          <RoleFaqItem faq={faq} />
        </li>
      ))}
    </ul>
  );
}

function RoleFaqItem({ faq }: { faq: RoleStarterFaqCard }) {
  const [open, setOpen] = useState(false);

  return (
    <details
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
      className={cn(
        'group rounded-lg border border-slate-200 bg-white shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900',
        open && 'border-brand-300 dark:border-brand-700',
      )}
    >
      <summary className="flex cursor-pointer items-center gap-3 px-3 py-3 marker:hidden sm:px-4 [&::-webkit-details-marker]:hidden">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300">
          <HelpCircle className="h-3.5 w-3.5" />
        </span>
        <h3 className="min-w-0 flex-1 text-sm font-medium text-slate-900 dark:text-slate-100">
          {faq.question}
        </h3>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-slate-400 transition-transform',
            open && 'rotate-180 text-brand-600',
          )}
        />
      </summary>
      <div className="border-t border-slate-100 px-3 py-3 dark:border-slate-800 sm:px-4 sm:pl-14">
        <MarkdownView source={faq.answerMarkdown} className="text-sm leading-7" />
      </div>
    </details>
  );
}
