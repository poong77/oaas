import { requireRole } from '@/lib/permissions';
import { AdminEditorHelpContent } from '../../_components/admin-editor-help-content';

export const dynamic = 'force-dynamic';
export const metadata = { title: '리치 에디터 가이드 — 운영자' };

export default async function EditorHelpPage() {
  await requireRole(['manager', 'admin']);

  return (
    <div className="flex flex-col gap-5 py-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          리치 에디터 운영자 가이드
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          공지·아티클·FAQ·체크리스트·빠른답변·티켓 답변에서 사용하는 통합 에디터의 단축키·기능 안내입니다.
        </p>
      </header>

      <AdminEditorHelpContent />
    </div>
  );
}
