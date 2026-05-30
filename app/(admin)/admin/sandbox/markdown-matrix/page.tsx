/**
 * /admin/sandbox/markdown-matrix — RichEditor markdown 회귀 검증 sandbox.
 *
 * Tiptap Option A (Design D-2) 적용 후 풀스택 톨바의 14종 스타일이
 * markdown(+ 인라인 HTML) 저장 모드에서 정상 보존되는지 시각 확인.
 *
 * 운영 환경에서는 404 (NODE_ENV check).
 *
 * @see docs/02-design/features/아티클관리시스템.design.md §7
 */

import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/permissions';
import { MarkdownMatrixClient } from './_components/markdown-matrix-client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Markdown 회귀 매트릭스 — sandbox' };

export default async function MarkdownMatrixPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }
  await requireRole(['admin']);

  return (
    <div className="space-y-4 py-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Markdown 회귀 매트릭스 sandbox
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Tiptap Option A 적용 후 풀스택 톨바의 14종 스타일이 markdown(+ 인라인 HTML)으로
          정상 직렬화되는지 검증. 운영 환경(production)에서는 404.
        </p>
      </header>
      <MarkdownMatrixClient />
    </div>
  );
}
