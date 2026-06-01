'use client';

/**
 * 골든셋 관리 — 수기 질의 추가 + 목록 + 소프트 삭제.
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { useConfirmDialog } from '@/components/dialogs/confirm-dialog';
import {
  createEvalQueryAction,
  archiveEvalQueryAction,
} from '@/app/actions/search-eval-actions';

type Row = {
  id: string;
  query: string;
  expectedArticleSlugs: string[];
  expectedFaqIds: string[];
  productCode: string | null;
  source: 'faq' | 'manual' | 'llm';
  note: string | null;
};

const SOURCE_LABEL: Record<Row['source'], string> = {
  faq: 'FAQ',
  manual: '수기',
  llm: 'AI',
};

function csv(s: string): string[] {
  return s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}

export function QueryManager({ queries }: { queries: Row[] }) {
  const router = useRouter();
  const confirm = useConfirmDialog();
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [slugs, setSlugs] = useState('');
  const [faqIds, setFaqIds] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  function refresh() {
    startTransition(() => router.refresh());
  }

  async function onAdd() {
    if (query.trim().length < 2) {
      toast.error('질의는 2자 이상');
      return;
    }
    setBusy(true);
    try {
      const res = await createEvalQueryAction({
        query: query.trim(),
        expectedArticleSlugs: csv(slugs),
        expectedFaqIds: csv(faqIds),
        note: note.trim() || null,
      });
      if (res.ok) {
        toast.success('추가되었습니다');
        setQuery('');
        setSlugs('');
        setFaqIds('');
        setNote('');
        setOpen(false);
        refresh();
      } else {
        toast.error(`추가 실패: ${res.message ?? '오류'}`);
      }
    } finally {
      setBusy(false);
    }
  }

  async function onArchive(row: Row) {
    const ok = await confirm({
      title: '골든셋에서 제거',
      description: `"${row.query}" 질의를 정답셋에서 제거할까요?`,
      confirmText: '제거',
      tone: 'danger',
    });
    if (!ok) return;
    const res = await archiveEvalQueryAction(row.id);
    if (res.ok) {
      toast.success('제거되었습니다');
      refresh();
    } else {
      toast.error('제거 실패');
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="p-4">
          {!open ? (
            <Button onClick={() => setOpen(true)} size="sm">
              <Plus className="mr-1.5 h-4 w-4" />
              질의 추가
            </Button>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500">
                  테스트 질의 *
                </label>
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="예: 문이 안 열려요"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-500">
                    정답 아티클 slug (쉼표 구분)
                  </label>
                  <Input
                    value={slugs}
                    onChange={(e) => setSlugs(e.target.value)}
                    placeholder="keyless-door-reset, ..."
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-500">
                    정답 FAQ id (쉼표 구분)
                  </label>
                  <Input
                    value={faqIds}
                    onChange={(e) => setFaqIds(e.target.value)}
                    placeholder="uuid, uuid"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500">
                  메모/분류 (선택)
                </label>
                <Input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="도어락"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={onAdd} disabled={busy} size="sm">
                  저장
                </Button>
                <Button
                  onClick={() => setOpen(false)}
                  variant="ghost"
                  size="sm"
                >
                  취소
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="border-b border-slate-100 p-4 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              골든셋 ({queries.length})
            </h2>
          </div>
          {queries.length === 0 ? (
            <div className="p-6">
              <EmptyState
                title="골든셋이 비어 있습니다"
                description="대시보드에서 'FAQ에서 시드' 또는 'AI 질의 생성'으로 빠르게 채우거나, 위에서 직접 추가하세요."
              />
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {queries.map((q) => (
                <li
                  key={q.id}
                  className="flex items-start justify-between gap-3 p-4"
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-slate-900 dark:text-slate-100">
                        {q.query}
                      </span>
                      <Badge tone="slate">{SOURCE_LABEL[q.source]}</Badge>
                      {q.note && <Badge tone="brand">{q.note}</Badge>}
                    </div>
                    <p className="text-xs text-slate-500">
                      정답:{' '}
                      {q.expectedArticleSlugs.length > 0 &&
                        `아티클 ${q.expectedArticleSlugs.join(', ')}`}
                      {q.expectedArticleSlugs.length > 0 &&
                        q.expectedFaqIds.length > 0 &&
                        ' / '}
                      {q.expectedFaqIds.length > 0 &&
                        `FAQ ${q.expectedFaqIds.length}건`}
                      {q.expectedArticleSlugs.length === 0 &&
                        q.expectedFaqIds.length === 0 &&
                        '미지정 (LLM 채점 권장)'}
                    </p>
                  </div>
                  <Button
                    onClick={() => onArchive(q)}
                    variant="ghost"
                    size="icon"
                    aria-label="제거"
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
