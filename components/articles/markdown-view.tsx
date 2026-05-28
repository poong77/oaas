'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import { cn } from '@/lib/utils';

/**
 * 마크다운 렌더 — RSC에서 그대로 사용 가능.
 *
 * 보안:
 *   - react-markdown 기본 설정은 raw HTML을 렌더하지 않음 (XSS 방어 기본).
 *   - GFM, slug 자동 anchor + autolink (TOC 점프 지원).
 *
 * 스타일: Tailwind prose 대신 직접 스타일 (다크모드 + 통일 토큰).
 */
export function MarkdownView({
  source,
  className,
}: {
  source: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'markdown-view prose-zinc max-w-none text-[0.95rem] leading-7 text-slate-800 dark:text-slate-100',
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[
          rehypeSlug,
          [
            rehypeAutolinkHeadings,
            {
              behavior: 'wrap',
              properties: { className: 'heading-anchor' },
            },
          ],
        ]}
        components={{
          h1: ({ children, ...props }) => (
            <h1
              {...props}
              className="mb-4 mt-8 scroll-mt-24 text-2xl font-bold tracking-tight"
            >
              {children}
            </h1>
          ),
          h2: ({ children, ...props }) => (
            <h2
              {...props}
              className="mb-3 mt-7 scroll-mt-24 border-b border-slate-200 pb-1 text-xl font-bold tracking-tight dark:border-slate-700"
            >
              {children}
            </h2>
          ),
          h3: ({ children, ...props }) => (
            <h3
              {...props}
              className="mb-2 mt-5 scroll-mt-24 text-base font-bold tracking-tight"
            >
              {children}
            </h3>
          ),
          p: ({ children, ...props }) => (
            <p {...props} className="my-3 leading-7">
              {children}
            </p>
          ),
          ul: ({ children, ...props }) => (
            <ul
              {...props}
              className="my-3 ml-6 list-disc space-y-1 marker:text-slate-400"
            >
              {children}
            </ul>
          ),
          ol: ({ children, ...props }) => (
            <ol
              {...props}
              className="my-3 ml-6 list-decimal space-y-1 marker:text-slate-400"
            >
              {children}
            </ol>
          ),
          li: ({ children, ...props }) => (
            <li {...props} className="leading-7">
              {children}
            </li>
          ),
          blockquote: ({ children, ...props }) => (
            <blockquote
              {...props}
              className="my-4 border-l-4 border-brand-300 bg-brand-50/50 px-4 py-2 italic text-slate-700 dark:border-brand-700 dark:bg-brand-950/30 dark:text-slate-200"
            >
              {children}
            </blockquote>
          ),
          a: ({ children, href, ...props }) => (
            <a
              {...props}
              href={href}
              className="text-brand-600 underline underline-offset-2 hover:text-brand-500 dark:text-brand-400"
              target={
                href?.startsWith('http') ? '_blank' : undefined
              }
              rel={
                href?.startsWith('http')
                  ? 'noopener noreferrer'
                  : undefined
              }
            >
              {children}
            </a>
          ),
          code: ({ className, children, ...props }) => {
            const isInline = !/language-/.test(className ?? '');
            return isInline ? (
              <code
                {...props}
                className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.85em] text-rose-600 dark:bg-slate-800 dark:text-rose-300"
              >
                {children}
              </code>
            ) : (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
          pre: ({ children, ...props }) => (
            <pre
              {...props}
              className="my-4 overflow-x-auto rounded-md bg-slate-900 p-4 text-xs leading-6 text-slate-100"
            >
              {children}
            </pre>
          ),
          hr: ({ ...props }) => (
            <hr {...props} className="my-6 border-slate-200 dark:border-slate-700" />
          ),
          table: ({ children, ...props }) => (
            <div className="my-4 overflow-x-auto">
              <table
                {...props}
                className="w-full border-collapse text-sm"
              >
                {children}
              </table>
            </div>
          ),
          th: ({ children, ...props }) => (
            <th
              {...props}
              className="border border-slate-200 bg-slate-50 px-3 py-2 text-left font-semibold dark:border-slate-700 dark:bg-slate-800"
            >
              {children}
            </th>
          ),
          td: ({ children, ...props }) => (
            <td
              {...props}
              className="border border-slate-200 px-3 py-2 dark:border-slate-700"
            >
              {children}
            </td>
          ),
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
