'use client';

import { useEffect, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from 'tiptap-markdown';

const INITIAL_MARKDOWN = `# OA서포트 리치 에디터 호환성 검증

이건 **Tiptap v3** + *tiptap-markdown* 마운트 테스트입니다.

## 기본 마크다운 기능

- 글머리 목록 1
- 글머리 목록 2

1. 번호 목록
2. 두 번째 항목

> 인용 블록입니다. 마크다운 → WYSIWYG → 다시 마크다운 변환 확인.

\`\`\`ts
const sample = '코드 블록';
const ok: boolean = true;
\`\`\`

[외부 링크](https://tiptap.dev)
`;

export function EditorCheckClient() {
  const [markdownOutput, setMarkdownOutput] = useState<string>('(초기화 대기 중)');
  const [mountStatus, setMountStatus] = useState<'pending' | 'mounted' | 'failed'>('pending');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Markdown.configure({
        html: false,
        breaks: true,
        tightLists: true,
        linkify: true,
      }),
    ],
    content: INITIAL_MARKDOWN,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          'min-h-[280px] max-w-none rounded-md border border-slate-200 bg-white p-4 text-sm leading-7 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-800 dark:bg-slate-950',
      },
    },
    onUpdate: ({ editor }) => {
      try {
        const md = editor.storage.markdown.getMarkdown() as string;
        setMarkdownOutput(md);
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : String(err));
      }
    },
  });

  useEffect(() => {
    if (!editor) return;
    try {
      const md = editor.storage.markdown.getMarkdown() as string;
      setMarkdownOutput(md);
      setMountStatus('mounted');
    } catch (err) {
      setMountStatus('failed');
      setErrorMessage(err instanceof Error ? err.message : String(err));
    }
  }, [editor]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="space-y-2">
        <h2 className="text-base font-semibold text-slate-700 dark:text-slate-200">에디터 (WYSIWYG)</h2>
        <EditorContent editor={editor} />
        <p className="text-xs text-slate-500 dark:text-slate-400">
          마운트 상태:{' '}
          {mountStatus === 'mounted' && <span className="font-medium text-emerald-600">✅ 성공</span>}
          {mountStatus === 'pending' && <span className="font-medium text-amber-600">⏳ 초기화 중...</span>}
          {mountStatus === 'failed' && <span className="font-medium text-rose-600">❌ 실패</span>}
        </p>
        {errorMessage && (
          <pre className="rounded-md border border-rose-300 bg-rose-50 p-2 text-xs text-rose-900 dark:border-rose-700 dark:bg-rose-950/40 dark:text-rose-200">
            {errorMessage}
          </pre>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-slate-700 dark:text-slate-200">출력 (마크다운)</h2>
        <pre className="min-h-[280px] overflow-auto rounded-md border border-slate-200 bg-slate-50 p-4 text-xs leading-5 text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
          {markdownOutput}
        </pre>
      </section>

      <section className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200 lg:col-span-2">
        <strong className="block">검증 체크리스트:</strong>
        <ul className="ml-4 list-disc space-y-1">
          <li>좌측 에디터에 헤딩·목록·코드·인용이 렌더되어야 함</li>
          <li>편집 시 우측 마크다운이 실시간 갱신되어야 함</li>
          <li>브라우저 콘솔에 React hydration mismatch 또는 element.ref 에러가 없어야 함</li>
          <li>운영 환경(production)에서 본 페이지는 404</li>
        </ul>
      </section>
    </div>
  );
}
