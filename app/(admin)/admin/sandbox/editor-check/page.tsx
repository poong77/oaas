import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/permissions';
import { EditorCheckClient } from './_components/editor-check-client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Tiptap 호환성 검증 sandbox' };

export default async function EditorCheckPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }
  await requireRole(['admin']);

  return (
    <div className="space-y-4 py-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Tiptap v3 호환성 검증 sandbox
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          React 19 + Next 16 + Tiptap v3 + tiptap-markdown 마운트와 마크다운 입출력 확인. 운영 환경(production)에서는 404.
        </p>
      </header>
      <EditorCheckClient />
    </div>
  );
}
