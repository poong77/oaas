// 순수 렌더링 컴포넌트(클라이언트 훅·이벤트 없음) → 서버 컴포넌트로 동작시켜
// react-markdown + remark/rehype 플러그인 번들이 클라이언트로 새지 않도록 한다.
// (서버 페이지에서 import 시 RSC 렌더, 클라 컴포넌트에서 import 시에만 클라 번들 포함)
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import { visit } from 'unist-util-visit';
import type { Root, Element } from 'hast';
import { cn } from '@/lib/utils';

/**
 * iframe src 도메인 화이트리스트 필터.
 * YouTube/YouTube-NoCookie/Vimeo 외 iframe은 안전한 안내 div로 대체.
 */
const ALLOWED_IFRAME_DOMAINS = [
  'youtube.com',
  'www.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
  'player.vimeo.com',
];

function rehypeIframeAllowlist() {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element) => {
      if (node.tagName !== 'iframe') return;
      const src = node.properties?.src;
      if (typeof src !== 'string') {
        node.tagName = 'div';
        node.properties = {};
        node.children = [{ type: 'text', value: '[빈 iframe 차단됨]' }];
        return;
      }
      try {
        const url = new URL(src);
        const ok = ALLOWED_IFRAME_DOMAINS.includes(url.hostname);
        if (!ok) {
          node.tagName = 'div';
          node.properties = {
            className: 'rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900',
          };
          node.children = [{ type: 'text', value: `[차단된 iframe: ${url.hostname}]` }];
        }
      } catch {
        node.tagName = 'div';
        node.properties = {};
        node.children = [{ type: 'text', value: '[잘못된 iframe URL 차단됨]' }];
      }
    });
  };
}

/**
 * 마크다운 렌더 — RSC에서 그대로 사용 가능.
 *
 * 보안:
 *   - rehype-raw로 HTML 파싱 (RichEditor 풀스택 톨바의 인라인 스타일 보존 위함)
 *   - rehype-sanitize 화이트리스트로 XSS 방어 (style·color·align·font 속성만 허용)
 *   - GFM, slug 자동 anchor + autolink (TOC 점프 지원)
 *
 * 스타일: Tailwind prose 대신 직접 스타일 (다크모드 + 통일 토큰).
 */

// 인라인 스타일·color·align·font-family·font-size·YouTube iframe·하이라이트 화이트리스트
const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    '*': [
      ...(defaultSchema.attributes?.['*'] ?? []),
      'style',
      'className',
      'class',
      'data-color', // Tiptap Highlight multicolor
      'data-text-align', // (옵션) 일부 정렬 익스텐션
    ],
    span: [
      ...((defaultSchema.attributes?.span as string[] | undefined) ?? []),
      'style',
    ],
    mark: ['style', 'data-color', 'className', 'class'],
    div: [
      ...((defaultSchema.attributes?.div as string[] | undefined) ?? []),
      'style',
      'data-youtube-video',
    ],
    h1: [['style']],
    h2: [['style']],
    h3: [['style']],
    p: [['style']],
    li: ['style', 'data-checked', 'data-type'],
    ul: ['style', 'data-type'],
    iframe: [
      'src',
      'width',
      'height',
      'allow',
      'allowfullscreen',
      'frameborder',
      'title',
    ],
  },
  tagNames: [...(defaultSchema.tagNames ?? []), 'iframe', 'mark', 'u'],
  // style 속성은 css 파싱이 무거우니 화이트리스트 패턴은 별도 적용 안 함 (브라우저가 자체 안전 처리)
};

/**
 * 레거시 본문 이미지 URL 보정.
 *
 * 비공개 버킷의 원본 S3 URL(`https://<bucket>.s3.<region>.amazonaws.com/editor/...`)을
 * 인증 프록시(`/api/files/view?key=...`)로 재작성한다. 신규 업로드는 이미 프록시 URL로
 * 저장되지만, 과거에 직접 S3 URL로 저장된 본문 이미지를 표시 가능하게 만든다.
 *
 * - editor 본문 이미지(키에 `editor/` 포함)만 변환. 나머지는 원본 유지.
 * - 잘못된 키는 서버 프록시(isEditorUploadKey)가 404로 거른다.
 * - aws-sdk 의존 없이 순수 문자열 처리 (클라이언트 번들 안전).
 */
function rewriteLegacyUploadUrl(url: string): string {
  try {
    const u = new URL(url, 'http://_'); // 상대경로도 안전 파싱
    const isS3Host =
      /\.amazonaws\.com$/i.test(u.hostname) && /(^|\.)s3[.-]/i.test(u.hostname);
    if (!isS3Host) return url;
    const key = decodeURIComponent(u.pathname).replace(/^\/+/, '');
    if (!/(^|\/)editor\//.test(key)) return url;
    return `/api/files/view?key=${encodeURIComponent(key)}`;
  } catch {
    return url;
  }
}

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
        urlTransform={(url) => defaultUrlTransform(rewriteLegacyUploadUrl(url))}
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[
          rehypeRaw,
          rehypeIframeAllowlist, // iframe src 도메인 화이트리스트 (sanitize 전에)
          [rehypeSanitize, sanitizeSchema],
          rehypeSlug,
          [
            rehypeAutolinkHeadings,
            {
              // 'wrap'은 heading 안에 a를 넣어 색·밑줄을 오염시킴.
              // 'append'는 heading 옆에 별도 # 링크 추가하여 heading 스타일 보존.
              behavior: 'append',
              properties: { className: 'heading-anchor', ariaHidden: true, tabIndex: -1 },
              content: [],
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
              className="mb-3 mt-7 scroll-mt-24 border-b border-slate-200 pb-1 text-xl font-bold tracking-tight text-brand-700 dark:border-slate-700 dark:text-brand-300"
            >
              {children}
            </h2>
          ),
          h3: ({ children, ...props }) => (
            <h3
              {...props}
              className="mb-2 mt-5 scroll-mt-24 text-base font-bold tracking-tight text-brand-700 dark:text-brand-300"
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
          mark: ({ children, ...props }) => {
            // Tiptap Highlight: data-color 속성 또는 style background-color
            const dataColor = (props as { 'data-color'?: string })['data-color'];
            const styleProp = (props as { style?: React.CSSProperties }).style;
            const bg = dataColor || styleProp?.backgroundColor;
            return (
              <mark
                {...props}
                style={{
                  ...styleProp,
                  backgroundColor: bg || '#fef08a', // 기본 노란색
                  padding: '0 0.15em',
                  borderRadius: '0.2em',
                }}
              >
                {children}
              </mark>
            );
          },
          u: ({ children, ...props }) => (
            <u {...props} className="underline underline-offset-2">
              {children}
            </u>
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
