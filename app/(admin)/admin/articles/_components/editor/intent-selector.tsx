'use client';

/**
 * IntentSelector — 사용자 의도(content_type) 3-card 선택 (A1).
 *
 * 흐름:
 *   - 카드 호버 → popover로 골격 미리보기 (hoverPreview)
 *   - 카드 클릭 → onChange(contentType) 호출
 *   - 부모가 confirm dialog 처리 + 본문 골격 주입 결정
 *
 * @see docs/02-design/knowledge-base-overhaul/DESIGN.md §7-2
 */

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import type { ArticleContentType } from '@/db/schema';
import {
  getTemplateHoverPreview,
  type ArticleTemplate,
} from '@/lib/articles/templates';
import { CONTENT_TYPE_OPTIONS } from '@/lib/articles/content-type-meta';

const OPTIONS = CONTENT_TYPE_OPTIONS;

export interface IntentSelectorProps {
  value: ArticleContentType;
  onChange: (next: ArticleContentType) => void;
  /** 외부에서 DB에서 골격 fetch한 결과를 hover popover에 사용 (선택). */
  templatesPreview?: Partial<Record<ArticleContentType, string>>;
  disabled?: boolean;
}

export function IntentSelector({
  value,
  onChange,
  templatesPreview,
  disabled = false,
}: IntentSelectorProps) {
  const [hovered, setHovered] = useState<ArticleContentType | null>(null);

  return (
    <Card>
      <CardContent className="p-5">
        <Label className="mb-2 block">
          사용자 의도 (content_type) <span className="text-red-500">*</span>
        </Label>
        <div className="grid gap-2 sm:grid-cols-3">
          {OPTIONS.map((o) => {
            const selected = value === o.value;
            const preview =
              templatesPreview?.[o.value] ?? getTemplateHoverPreview(o.value);
            return (
              <div key={o.value} className="relative">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange(o.value)}
                  onMouseEnter={() => setHovered(o.value)}
                  onMouseLeave={() => setHovered(null)}
                  onFocus={() => setHovered(o.value)}
                  onBlur={() => setHovered(null)}
                  aria-pressed={selected}
                  className={`flex w-full flex-col items-start gap-1 rounded-md border px-3 py-2.5 text-left transition ${
                    selected
                      ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-500/30 dark:border-brand-400 dark:bg-brand-950/40'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:scale-[1.01] dark:border-slate-800 dark:bg-slate-900'
                  } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-center gap-1.5">
                    <Badge tone={o.tone} className="text-[10px]">
                      {o.value}
                    </Badge>
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {o.label}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {o.hint}
                  </span>
                </button>
                {hovered === o.value && !disabled && (
                  <div
                    role="tooltip"
                    className="pointer-events-none absolute left-0 right-0 top-full z-10 mt-1 rounded-md border border-slate-200 bg-white p-2 text-xs leading-relaxed text-slate-700 shadow-lg dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  >
                    {preview}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

/** 외부에서 templatesPreview 객체로 변환할 때 사용. */
export function buildPreviewMap(
  byType: Partial<Record<ArticleContentType, ArticleTemplate>>,
): Partial<Record<ArticleContentType, string>> {
  const out: Partial<Record<ArticleContentType, string>> = {};
  for (const [k, v] of Object.entries(byType)) {
    if (v) out[k as ArticleContentType] = v.hoverPreview;
  }
  return out;
}
