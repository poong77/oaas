'use client';

/**
 * 14종 스타일 회귀 매트릭스 클라이언트.
 *
 * 실제 RichEditor 컴포넌트(rich-editor.tsx)를 그대로 사용하여 풀스택 톨바 환경 재현.
 * 좌: 에디터, 우: 저장될 markdown(+ 인라인 HTML) 미리보기.
 *
 * @see docs/02-design/features/아티클관리시스템.design.md §7.2 매트릭스
 */

import { useState } from 'react';
import { RichEditor } from '@/components/editor/rich-editor';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const INITIAL_CONTENT = `# 14종 스타일 회귀 매트릭스

각 항목을 톨바로 적용해보고, 우측 저장 결과에서 보존 여부를 확인하세요.

## ✅ Markdown 표현 가능 (7종)

- **볼드** / *이탤릭* / ~~취소선~~ — basic
- 글머리: 위 목록 자체
- 1. 번호 목록
- [ ] 체크리스트 / [x] 완료
- 표:

| 헤더 | 값 |
|:-|:-|
| A | 1 |
| B | 2 |

- 코드블록:

\`\`\`ts
const ok: boolean = true;
\`\`\`

- 링크: [tiptap.dev](https://tiptap.dev)
- 이미지: ![alt](https://placehold.co/100x60)

## ⚠️ Markdown 표현 불가 — html:true로 보존되어야 함 (7종)

다음 항목들을 톨바로 적용해보세요:

1. **밑줄 (Underline)** — 이 줄에 밑줄 적용. \`<u>...</u>\`로 보존되어야 함
2. **형광펜 (Highlight)** — 이 줄에 형광펜 적용. \`<mark>...</mark>\`로 보존
3. **폰트 사이즈** — 이 줄을 16px → 24px로 변경. \`<span style="font-size:24px">\`로 보존
4. **폰트 컬러** — 이 줄을 빨강으로 변경. \`<span style="color:#dc2626">\`로 보존
5. **폰트 패밀리** — 이 줄을 Serif로 변경. \`<span style="font-family:serif">\`로 보존
6. **정렬 (Center)** — 이 단락을 가운데 정렬. \`<p style="text-align:center">\`로 보존
7. **YouTube 임베드** — 톨바에서 YouTube 추가. 커스텀 HTML로 보존

## 검증 방법

1. 좌측 에디터에서 각 스타일을 직접 적용
2. 우측 출력에서 해당 스타일이 markdown 또는 HTML로 보존되는지 확인
3. 새로고침해서 상태 유지 확인 (autoSave 없음, 새로고침 시 초기화 — 정상)
`;

const MATRIX = [
  { key: 'h1-h3', label: 'H1/H2/H3', expected: 'markdown', status: 'expected' },
  { key: 'bold', label: '볼드', expected: 'markdown', status: 'expected' },
  { key: 'italic', label: '이탤릭', expected: 'markdown', status: 'expected' },
  { key: 'strike', label: '취소선', expected: 'markdown', status: 'expected' },
  { key: 'underline', label: '밑줄', expected: 'HTML <u>', status: 'expected' },
  { key: 'highlight', label: '형광펜', expected: 'HTML <mark>', status: 'expected' },
  { key: 'table', label: '표 (GFM)', expected: 'markdown', status: 'expected' },
  { key: 'checklist', label: '체크리스트', expected: 'markdown', status: 'expected' },
  { key: 'image', label: '이미지', expected: 'markdown', status: 'expected' },
  { key: 'link', label: '링크', expected: 'markdown', status: 'expected' },
  { key: 'font-size', label: '폰트 사이즈', expected: 'HTML span style', status: 'expected' },
  { key: 'font-color', label: '폰트 컬러', expected: 'HTML span style', status: 'expected' },
  { key: 'font-family', label: '폰트 패밀리', expected: 'HTML span style', status: 'expected' },
  { key: 'text-align', label: '정렬 (좌/중/우/양쪽)', expected: 'HTML p style', status: 'expected' },
  { key: 'youtube', label: 'YouTube 임베드', expected: 'HTML 커스텀', status: 'expected' },
  { key: 'codeblock', label: '코드블록', expected: 'markdown', status: 'expected' },
] as const;

export function MarkdownMatrixClient() {
  const [content, setContent] = useState(INITIAL_CONTENT);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="lg:col-span-2">
        <CardContent className="p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            14종 매트릭스 체크리스트
          </h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {MATRIX.map((m) => (
              <div
                key={m.key}
                className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900"
              >
                <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
                  {m.label}
                </span>
                <Badge tone="brand" className="text-[10px]">
                  {m.expected}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-slate-700 dark:text-slate-200">
          에디터 (full 톨바)
        </h2>
        <RichEditor
          value={content}
          onChange={setContent}
          mode="full"
          minHeight={520}
        />
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-slate-700 dark:text-slate-200">
          저장될 출력 (markdown + 인라인 HTML)
        </h2>
        <pre className="min-h-[520px] overflow-auto rounded-md border border-slate-200 bg-slate-50 p-4 text-xs leading-5 text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
          {content || '(빈 본문)'}
        </pre>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          tip: <code>&lt;u&gt;</code>, <code>&lt;mark&gt;</code>,{' '}
          <code>style=&quot;font-size:...&quot;</code>,{' '}
          <code>style=&quot;color:...&quot;</code>,{' '}
          <code>style=&quot;text-align:...&quot;</code> 같은 인라인 HTML이 markdown 본문에
          섞여 나타나면 정상입니다. (Tiptap Option A — html:true)
        </p>
      </section>
    </div>
  );
}
