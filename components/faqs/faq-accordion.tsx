'use client';

/**
 * FAQ 아코디언 — Phase 4 SF-01.
 *
 * - `<details>` 활용 (SSR 안정, JS 없이도 펼침 동작)
 * - 펼침 시 view counter +1 (fire-and-forget Server Action)
 * - URL hash `#faq-{id}` 진입 시 해당 아이템 자동 펼침
 * - 도움됨 위젯 펼침 후 표시
 */

import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { MarkdownView } from '@/components/articles/markdown-view';
import { bumpFaqViewAction } from '@/app/actions/faq-actions';
import { FaqHelpfulWidget } from './faq-helpful-widget';
import type { FaqListItem } from '@/lib/services/faqs';
import type { ProductCategoryView } from '@/lib/services/categories';
import { cn } from '@/lib/utils';

export function FaqAccordion({
  items,
  productMap,
  issueTypeMap,
}: {
  items: FaqListItem[];
  productMap: Record<string, ProductCategoryView>;
  issueTypeMap: Record<string, string>;
}) {
  return (
    <ul className="grid gap-3">
      {items.map((faq) => (
        <li key={faq.id}>
          <FaqAccordionItem
            faq={faq}
            productLabel={productMap[faq.productCode]?.label ?? faq.productCode}
            issueLabel={faq.issueType ? issueTypeMap[faq.issueType] ?? faq.issueType : null}
          />
        </li>
      ))}
    </ul>
  );
}

function FaqAccordionItem({
  faq,
  productLabel,
  issueLabel,
}: {
  faq: FaqListItem;
  productLabel: string;
  issueLabel: string | null;
}) {
  const [open, setOpen] = useState(false);
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const bumpedRef = useRef(false);

  // URL hash 매칭 자동 펼침
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handle = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash === `faq-${faq.id}`) {
        setOpen(true);
        detailsRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }
    };
    handle();
    window.addEventListener('hashchange', handle);
    return () => window.removeEventListener('hashchange', handle);
  }, [faq.id]);

  // 펼침 시 view counter +1 (한 번만)
  useEffect(() => {
    if (open && !bumpedRef.current) {
      bumpedRef.current = true;
      void bumpFaqViewAction(faq.id);
    }
  }, [open, faq.id]);

  return (
    <details
      id={`faq-${faq.id}`}
      ref={detailsRef}
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
      className={cn(
        'group rounded-lg border border-slate-200 bg-white shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900',
        open && 'border-brand-300 dark:border-brand-700',
      )}
    >
      <summary
        className="flex cursor-pointer items-start justify-between gap-3 px-4 py-3 marker:hidden [&::-webkit-details-marker]:hidden"
      >
        <div className="flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <Badge tone="brand" className="uppercase">
              {productLabel}
            </Badge>
            {issueLabel && <Badge tone="slate">{issueLabel}</Badge>}
            <span className="text-[10px] text-slate-400 dark:text-slate-500">
              조회 {faq.viewCount.toLocaleString()}
            </span>
          </div>
          <h3 className="text-sm font-semibold leading-snug text-slate-900 dark:text-slate-100 sm:text-base">
            {faq.question}
          </h3>
        </div>
        <ChevronDown
          className={cn(
            'mt-1 h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500 transition-transform',
            open && 'rotate-180 text-brand-600',
          )}
        />
      </summary>
      <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-800">
        <MarkdownView
          source={faq.answerMarkdown}
          className="text-sm leading-7"
        />
        <FaqHelpfulWidget
          faqId={faq.id}
          initialYes={faq.helpfulYes}
          initialNo={faq.helpfulNo}
        />
      </div>
    </details>
  );
}

