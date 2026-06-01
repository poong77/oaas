'use client';

/**
 * 검색 골든셋 통합 보드 — 측정(10배치 진행률) + 리스트(순위/추세/실사용) + 입력/AI추천.
 */

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Play,
  Plus,
  Sparkles,
  Database,
  Loader2,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { useConfirmDialog } from '@/components/dialogs/confirm-dialog';
import {
  evaluateBatchAction,
  saveRunAction,
  createEvalQueryAction,
  archiveEvalQueryAction,
  suggestFromLogsAction,
  suggestFromTroubleshootAction,
  bulkCreateEvalQueriesAction,
} from '@/app/actions/search-eval-actions';
import type { SearchEvalDetail, SearchEvalJudge } from '@/db/schema';

export type GoldenRow = {
  id: string;
  query: string;
  expectedArticleSlugs: string[];
  expectedFaqIds: string[];
  note: string | null;
  source: 'faq' | 'manual' | 'llm';
  latestRank: number | null;
  trend: (number | null)[];
  usage: {
    searches: number;
    ctr: number;
    ticketRate: number;
    avgClickPosition: number | null;
  } | null;
};

type Candidate = {
  query: string;
  source: 'log' | 'troubleshoot';
  reason: string;
  expectedArticleSlugs: string[];
  expectedFaqIds: string[];
  note: string | null;
  options?: { kind: 'help' | 'faq'; ref: string; title: string }[];
};

const SOURCE_LABEL: Record<GoldenRow['source'], string> = {
  faq: 'FAQ',
  manual: '수기',
  llm: 'AI',
};

function chunk<T>(arr: T[], parts: number): T[][] {
  const size = Math.ceil(arr.length / parts);
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function rankTone(r: number | null): 'success' | 'warn' | 'danger' | 'slate' {
  if (r === null) return 'slate';
  if (r <= 4) return 'success';
  if (r <= 8) return 'warn';
  return 'danger';
}

export function GoldenBoard({
  rows,
  queryIds,
  runCount,
}: {
  rows: GoldenRow[];
  queryIds: string[];
  runCount: number;
}) {
  const router = useRouter();
  const confirm = useConfirmDialog();
  const [, startTransition] = useTransition();
  const [judge, setJudge] = useState<SearchEvalJudge>('label');

  // 측정 진행률
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState(0);
  const [stepTotal, setStepTotal] = useState(10);

  // 입력/추천 모달
  const [addOpen, setAddOpen] = useState(false);
  const [seeding, setSeeding] = useState(false);

  function refresh() {
    startTransition(() => router.refresh());
  }

  async function runMeasure() {
    if (queryIds.length === 0) {
      toast.error('골든셋이 비어 있습니다. 먼저 질문을 추가하세요.');
      return;
    }
    const parts = Math.min(10, Math.max(1, queryIds.length));
    const batches = chunk(queryIds, parts);
    setRunning(true);
    setStep(0);
    setStepTotal(batches.length);
    try {
      let acc: SearchEvalDetail[] = [];
      for (let i = 0; i < batches.length; i++) {
        const res = await evaluateBatchAction(batches[i]!, judge);
        acc = acc.concat(res.details);
        setStep(i + 1);
      }
      const save = await saveRunAction(acc, judge);
      if (save.ok) {
        toast.success('측정 완료 — 순위가 갱신되었습니다');
        refresh();
      } else {
        toast.error(`저장 실패: ${save.message ?? '오류'}`);
      }
    } catch {
      toast.error('측정 중 오류가 발생했습니다');
    } finally {
      setRunning(false);
    }
  }

  const progressPct = stepTotal > 0 ? Math.round((step / stepTotal) * 100) : 0;

  return (
    <div className="flex flex-col gap-4">
      {/* 측정 + 입력/추천 컨트롤 */}
      <Card>
        <CardContent className="flex flex-col gap-4 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-500">
                적합도 판정
              </span>
              <div className="flex gap-2">
                {(['label', 'hybrid', 'llm'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    disabled={running}
                    onClick={() => setJudge(m)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                      judge === m
                        ? 'border-brand-400 bg-brand-50 text-brand-700 dark:border-brand-600 dark:bg-brand-950/40 dark:text-brand-300'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {m === 'label'
                      ? '라벨'
                      : m === 'hybrid'
                        ? '하이브리드'
                        : 'LLM'}
                  </button>
                ))}
              </div>
            </div>
            <Button onClick={runMeasure} disabled={running}>
              {running ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-1.5 h-4 w-4" />
              )}
              순위 측정 실행 ({queryIds.length}문항)
            </Button>
          </div>

          {/* 10단계 프로그레스바 */}
          {running && (
            <div className="flex flex-col gap-1">
              <div className="flex gap-1">
                {Array.from({ length: stepTotal }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-2 flex-1 rounded-full ${
                      i < step
                        ? 'bg-brand-500'
                        : 'bg-slate-200 dark:bg-slate-700'
                    }`}
                  />
                ))}
              </div>
              <span className="text-xs text-slate-500">
                {step}/{stepTotal} 단계 ({progressPct}%) — 검색 순위 측정 중…
              </span>
            </div>
          )}

          {/* 입력 / 추천 */}
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
            <span className="text-xs text-slate-500">질문 추가:</span>
            <Button
              onClick={() => setAddOpen((v) => !v)}
              variant="outline"
              size="sm"
              disabled={running}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              수기 입력
            </Button>
            <SuggestButton
              label="AI 추천: 검색이력"
              icon={<Database className="mr-1.5 h-4 w-4" />}
              load={async () => (await suggestFromLogsAction()).candidates}
              onDone={refresh}
              disabled={running}
            />
            <SuggestButton
              label="AI 추천: 문제해결 문서"
              icon={<Sparkles className="mr-1.5 h-4 w-4" />}
              load={async () =>
                (await suggestFromTroubleshootAction()).candidates
              }
              onDone={refresh}
              disabled={running}
            />
            <Button
              onClick={async () => {
                setSeeding(true);
                try {
                  const { seedFromFaqsAction } =
                    await import('@/app/actions/search-eval-actions');
                  const r = await seedFromFaqsAction();
                  if (r.ok) {
                    toast.success(`FAQ에서 ${r.created}건 추가`);
                    refresh();
                  }
                } finally {
                  setSeeding(false);
                }
              }}
              variant="ghost"
              size="sm"
              disabled={running || seeding}
            >
              {seeding ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : null}
              FAQ 시드
            </Button>
          </div>

          {addOpen && (
            <AddForm
              onClose={() => setAddOpen(false)}
              onDone={() => {
                setAddOpen(false);
                refresh();
              }}
            />
          )}
        </CardContent>
      </Card>

      {/* 리스트 */}
      <Card>
        <CardContent className="p-0">
          <div className="border-b border-slate-100 p-4 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              골든셋 ({rows.length})
            </h2>
          </div>
          {rows.length === 0 ? (
            <div className="p-6">
              <EmptyState
                title="골든셋이 비어 있습니다"
                description="FAQ 시드 · AI 추천 · 수기 입력으로 자주 묻는 질문을 채우고 측정하세요."
              />
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.map((r) => (
                <RowItem
                  key={r.id}
                  row={r}
                  confirm={confirm}
                  onDone={refresh}
                />
              ))}
            </ul>
          )}
          {runCount === 0 && rows.length > 0 && (
            <p className="border-t border-slate-100 p-3 text-center text-xs text-slate-400 dark:border-slate-800">
              아직 측정 기록이 없습니다. 위 &quot;순위 측정 실행&quot;을 눌러
              순위를 채우세요.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function RowItem({
  row,
  confirm,
  onDone,
}: {
  row: GoldenRow;
  confirm: ReturnType<typeof useConfirmDialog>;
  onDone: () => void;
}) {
  const trend = row.trend.filter((t) => t !== null) as number[];
  async function archive() {
    const ok = await confirm({
      title: '골든셋에서 제거',
      description: `"${row.query}" 질문을 제거할까요?`,
      confirmText: '제거',
      tone: 'danger',
    });
    if (!ok) return;
    const res = await archiveEvalQueryAction(row.id);
    if (res.ok) {
      toast.success('제거되었습니다');
      onDone();
    } else toast.error('제거 실패');
  }
  return (
    <li className="flex items-start justify-between gap-3 p-4">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={rankTone(row.latestRank)}>
            {row.latestRank === null ? '미측정' : `${row.latestRank}위`}
          </Badge>
          <span className="font-medium text-slate-900 dark:text-slate-100">
            {row.query}
          </span>
          <Badge tone="slate">{SOURCE_LABEL[row.source]}</Badge>
          {row.note && <Badge tone="brand">{row.note}</Badge>}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
          {trend.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              지난: {trend.join(' → ')}
              {row.latestRank !== null && ` → ${row.latestRank}`}
            </span>
          )}
          <span>
            정답:{' '}
            {row.expectedArticleSlugs.length + row.expectedFaqIds.length > 0
              ? `${row.expectedArticleSlugs.length + row.expectedFaqIds.length}개 지정`
              : '미지정(LLM 채점)'}
          </span>
          {row.usage && (
            <span className="text-slate-400">
              실사용 {row.usage.searches}회 · CTR{' '}
              {Math.round(row.usage.ctr * 100)}% · 접수{' '}
              {Math.round(row.usage.ticketRate * 100)}%
            </span>
          )}
        </div>
      </div>
      <Button onClick={archive} variant="ghost" size="icon" aria-label="제거">
        <Trash2 className="h-4 w-4 text-red-500" />
      </Button>
    </li>
  );
}

function AddForm({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: () => void;
}) {
  const [query, setQuery] = useState('');
  const [slugs, setSlugs] = useState('');
  const [faqIds, setFaqIds] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  async function save() {
    if (query.trim().length < 2) {
      toast.error('질문은 2자 이상');
      return;
    }
    setBusy(true);
    try {
      const res = await createEvalQueryAction({
        query: query.trim(),
        expectedArticleSlugs: slugs
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        expectedFaqIds: faqIds
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        note: note.trim() || null,
      });
      if (res.ok) {
        toast.success('추가되었습니다');
        onDone();
      } else toast.error(`추가 실패: ${res.message ?? '오류'}`);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="테스트 질문 (예: 문이 안 열려요)"
      />
      <div className="grid gap-2 sm:grid-cols-2">
        <Input
          value={slugs}
          onChange={(e) => setSlugs(e.target.value)}
          placeholder="정답 아티클 slug (쉼표)"
        />
        <Input
          value={faqIds}
          onChange={(e) => setFaqIds(e.target.value)}
          placeholder="정답 FAQ id (쉼표)"
        />
      </div>
      <Input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="메모/분류 (예: 도어락)"
      />
      <div className="flex gap-2">
        <Button onClick={save} disabled={busy} size="sm">
          저장
        </Button>
        <Button onClick={onClose} variant="ghost" size="sm">
          취소
        </Button>
      </div>
    </div>
  );
}

/** AI 추천 버튼 → 후보 로드 → 검수 모달 → 선택 일괄 추가. */
function SuggestButton({
  label,
  icon,
  load,
  onDone,
  disabled,
}: {
  label: string;
  icon: React.ReactNode;
  load: () => Promise<Candidate[]>;
  onDone: () => void;
  disabled?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);

  async function start() {
    setLoading(true);
    toast.info('AI가 후보를 생성 중입니다…');
    try {
      const c = await load();
      if (c.length === 0) {
        toast.info('새로 추천할 후보가 없습니다.');
        return;
      }
      setCandidates(c);
      setOpen(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        onClick={start}
        variant="outline"
        size="sm"
        disabled={disabled || loading}
      >
        {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : icon}
        {label}
      </Button>
      {open && (
        <SuggestModal
          candidates={candidates}
          onClose={() => setOpen(false)}
          onDone={() => {
            setOpen(false);
            onDone();
          }}
        />
      )}
    </>
  );
}

function SuggestModal({
  candidates,
  onClose,
  onDone,
}: {
  candidates: Candidate[];
  onClose: () => void;
  onDone: () => void;
}) {
  // 각 후보: 선택 여부 + (log) 정답 옵션 인덱스
  const [picked, setPicked] = useState<boolean[]>(() =>
    candidates.map(() => true),
  );
  const [answerIdx, setAnswerIdx] = useState<number[]>(() =>
    candidates.map(() => -1),
  );
  const [busy, setBusy] = useState(false);

  const selectedCount = useMemo(() => picked.filter(Boolean).length, [picked]);

  async function confirm() {
    const payload = candidates
      .map((c, i) => ({ c, i }))
      .filter(({ i }) => picked[i])
      .map(({ c, i }) => {
        let expectedArticleSlugs = c.expectedArticleSlugs;
        let expectedFaqIds = c.expectedFaqIds;
        if (c.options && answerIdx[i]! >= 0) {
          const opt = c.options[answerIdx[i]!]!;
          if (opt.kind === 'help') {
            expectedArticleSlugs = [opt.ref];
            expectedFaqIds = [];
          } else {
            expectedFaqIds = [opt.ref];
            expectedArticleSlugs = [];
          }
        }
        return {
          query: c.query,
          expectedArticleSlugs,
          expectedFaqIds,
          note: c.note,
          source: (c.source === 'log' ? 'manual' : 'llm') as 'manual' | 'llm',
        };
      });
    if (payload.length === 0) {
      toast.error('선택된 후보가 없습니다.');
      return;
    }
    setBusy(true);
    try {
      const res = await bulkCreateEvalQueriesAction(payload);
      if (res.ok) {
        toast.success(`${res.created}건 골든셋에 추가`);
        onDone();
      } else toast.error('추가 실패');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-xl dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 p-4 dark:border-slate-800">
          <h3 className="text-sm font-semibold">
            AI 추천 검수 ({candidates.length}건 · 선택 {selectedCount})
          </h3>
          <span className="text-xs text-slate-400">추가할 후보를 고르세요</span>
        </div>
        <ul className="flex-1 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
          {candidates.map((c, i) => (
            <li key={i} className="flex flex-col gap-2 p-3">
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={picked[i]}
                  onChange={(e) =>
                    setPicked((p) =>
                      p.map((v, idx) => (idx === i ? e.target.checked : v)),
                    )
                  }
                  className="mt-1"
                />
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {c.query}
                  </span>
                  <span className="text-xs text-slate-400">{c.reason}</span>
                </div>
              </label>
              {c.options && c.options.length > 0 && (
                <select
                  value={answerIdx[i]}
                  onChange={(e) =>
                    setAnswerIdx((a) =>
                      a.map((v, idx) =>
                        idx === i ? Number(e.target.value) : v,
                      ),
                    )
                  }
                  className="ml-6 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value={-1}>정답 미지정 (LLM 채점)</option>
                  {c.options.map((o, oi) => (
                    <option key={oi} value={oi}>
                      [{o.kind}] {o.title}
                    </option>
                  ))}
                </select>
              )}
            </li>
          ))}
        </ul>
        <div className="flex justify-end gap-2 border-t border-slate-100 p-3 dark:border-slate-800">
          <Button onClick={onClose} variant="ghost" size="sm">
            취소
          </Button>
          <Button onClick={confirm} disabled={busy} size="sm">
            {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            선택 추가
          </Button>
        </div>
      </div>
    </div>
  );
}
