'use client';

/**
 * 동의어 사전 — 원페이지 관리 UI.
 *
 * 한 화면에서:
 *   - 새 그룹 추가 (대표어 + 동의어 칩 + AI 추천(숙박업계 기준) + 저장)
 *   - 검색 (대표어·동의어 본문 즉시 필터)
 *   - 그룹별 인라인 편집 (동의어 추가/삭제, AI 추천, 그룹 삭제)
 *
 * 권한: 어드민/매니저. 모든 쓰기 후 router.refresh().
 */

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent,
} from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { BookA, Loader2, Plus, Search, Sparkles, Trash2, X } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useConfirmDialog } from '@/components/dialogs/confirm-dialog';
import {
  addSynonymAction,
  createGroupWithSynonymsAction,
  removeSynonymAction,
  suggestSynonymsAction,
  toggleTermGroupAction,
} from '@/app/actions/master-synonyms-actions';
import type { TermGroup, TermSynonym } from '@/db/schema';
import { KeywordGapCard, type GapItem } from './keyword-gap-card';

type GroupWithSynonyms = TermGroup & { synonyms: TermSynonym[] };

type GapData = {
  gaps: GapItem[];
  totalDistinctKeywords: number;
  coveredKeywords: number;
  dismissedKeywords: number;
  dismissedTerms: string[];
};

type Props = {
  groups: GroupWithSynonyms[];
  gapData: GapData;
};

/** 대표어 프리필 신호 (같은 값 재선택도 트리거되도록 카운터 포함). */
type Prefill = { term: string; n: number };

/** 입력 문자열을 칩 토큰으로 정규화 (쉼표/줄바꿈 분리, trim, 60자). */
function tokenize(raw: string): string[] {
  return raw
    .split(/[,\n]/)
    .map((t) => t.trim().slice(0, 60))
    .filter((t) => t.length > 0);
}

export function SynonymsManager({ groups, gapData }: Props) {
  const [query, setQuery] = useState('');
  const [prefill, setPrefill] = useState<Prefill | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter(
      (g) =>
        g.canonicalTerm.toLowerCase().includes(q) ||
        g.synonyms.some((s) => s.term.toLowerCase().includes(q)),
    );
  }, [groups, query]);

  return (
    <div className="flex flex-col gap-5">
      <NewGroupCard prefill={prefill} />

      <KeywordGapCard
        gaps={gapData.gaps}
        totalDistinctKeywords={gapData.totalDistinctKeywords}
        coveredKeywords={gapData.coveredKeywords}
        dismissedKeywords={gapData.dismissedKeywords}
        dismissedTerms={gapData.dismissedTerms}
        onPick={(term) =>
          setPrefill((prev) => ({ term, n: (prev?.n ?? 0) + 1 }))
        }
      />

      {/* 검색 */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="대표어 또는 동의어로 검색…"
          className="pl-9"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            aria-label="검색 지우기"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <span>
          {query
            ? `검색 결과 ${filtered.length}개`
            : `전체 ${groups.length}개 그룹`}
        </span>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <BookA className="h-10 w-10 text-slate-300" />
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {query
                ? `"${query}"에 해당하는 동의어 그룹이 없습니다.`
                : '아직 등록된 동의어 그룹이 없습니다. 위에서 추가하세요.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((g) => (
            <GroupRow key={g.id} group={g} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// 새 그룹 추가 카드
// ─────────────────────────────────────────────────────────────────

function NewGroupCard({ prefill }: { prefill: Prefill | null }) {
  const router = useRouter();
  const [canonical, setCanonical] = useState('');
  const [chips, setChips] = useState<string[]>([]);
  const [chipInput, setChipInput] = useState('');
  const [aiPending, startAi] = useTransition();
  const [savePending, startSave] = useTransition();
  const canonicalRef = useRef<HTMLInputElement>(null);

  // 갭 카드에서 칩을 고르면 대표어로 프리필 + 포커스/스크롤.
  useEffect(() => {
    if (!prefill) return;
    setCanonical(prefill.term);
    setChips([]);
    setChipInput('');
    const el = canonicalRef.current;
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.focus();
    }
  }, [prefill]);

  const addChips = (raw: string) => {
    const tokens = tokenize(raw);
    if (tokens.length === 0) return;
    setChips((prev) => {
      const seen = new Set([
        canonical.trim().toLowerCase(),
        ...prev.map((c) => c.toLowerCase()),
      ]);
      const next = [...prev];
      for (const t of tokens) {
        const key = t.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        next.push(t);
      }
      return next;
    });
    setChipInput('');
  };

  const removeChip = (term: string) =>
    setChips((prev) => prev.filter((c) => c !== term));

  const onChipKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addChips(chipInput);
    } else if (e.key === 'Backspace' && chipInput === '' && chips.length > 0) {
      setChips((prev) => prev.slice(0, -1));
    }
  };

  const runAi = () => {
    const term = canonical.trim();
    if (term.length < 1) {
      toast.warning('대표어를 먼저 입력하세요');
      return;
    }
    startAi(async () => {
      const res = await suggestSynonymsAction({
        canonicalTerm: term,
        existing: chips,
      });
      if (res.ok && res.synonyms?.length) {
        addChips(res.synonyms.join(','));
        toast.success(`AI가 ${res.synonyms.length}개 제안했어요`);
      } else {
        toast.error(res.message ?? 'AI 제안 실패');
      }
    });
  };

  const save = () => {
    const term = canonical.trim();
    if (term.length < 1) {
      toast.warning('대표어를 입력하세요');
      return;
    }
    // 입력 중인 칩도 합쳐서 저장
    const pendingTokens = tokenize(chipInput);
    const finalChips = [...chips];
    for (const t of pendingTokens) {
      if (!finalChips.some((c) => c.toLowerCase() === t.toLowerCase())) {
        finalChips.push(t);
      }
    }
    startSave(async () => {
      const res = await createGroupWithSynonymsAction({
        canonicalTerm: term,
        synonyms: finalChips,
      });
      if (res.ok) {
        toast.success(
          `"${term}" 추가됨 (동의어 ${res.added ?? 0}개)`,
        );
        setCanonical('');
        setChips([]);
        setChipInput('');
        router.refresh();
      } else {
        toast.error(res.message ?? '저장 실패');
      }
    });
  };

  const busy = aiPending || savePending;

  return (
    <Card className="border-brand-200 dark:border-brand-900/50">
      <CardContent className="flex flex-col gap-4 p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-300">
            <Plus className="h-4 w-4" />
          </div>
          <span className="font-semibold text-slate-900 dark:text-slate-100">
            동의어 그룹 추가
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-[minmax(0,220px)_1fr]">
          {/* 대표어 */}
          <div className="flex flex-col gap-1">
            <Label htmlFor="new-canonical" className="text-xs">
              대표어 <span className="text-red-500">*</span>
            </Label>
            <Input
              id="new-canonical"
              ref={canonicalRef}
              value={canonical}
              onChange={(e) => setCanonical(e.target.value)}
              placeholder="예: 체크인"
              maxLength={60}
              disabled={busy}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  // 대표어에서 Enter → 동의어 입력으로 포커스 이동 유도 (저장 X)
                  document.getElementById('new-chip-input')?.focus();
                }
              }}
            />
          </div>

          {/* 동의어 */}
          <div className="flex flex-col gap-1">
            <Label htmlFor="new-chip-input" className="text-xs">
              동의어{' '}
              <span className="text-slate-400">
                (Enter·쉼표로 추가 · {chips.length}개)
              </span>
            </Label>
            <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1.5 focus-within:border-brand-400 dark:border-slate-700 dark:bg-slate-900">
              {chips.map((c) => (
                <span
                  key={c}
                  className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-700 dark:bg-brand-950/40 dark:text-brand-300"
                >
                  {c}
                  <button
                    type="button"
                    onClick={() => removeChip(c)}
                    disabled={busy}
                    className="opacity-60 hover:opacity-100"
                    aria-label={`${c} 제거`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <input
                id="new-chip-input"
                value={chipInput}
                onChange={(e) => setChipInput(e.target.value)}
                onKeyDown={onChipKeyDown}
                onBlur={() => chipInput.trim() && addChips(chipInput)}
                placeholder={chips.length === 0 ? '예: CI, 입실, check-in' : ''}
                disabled={busy}
                className="min-w-[120px] flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400 disabled:opacity-50"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={runAi}
            disabled={busy || canonical.trim().length < 1}
            title="대표어 기준 숙박업계 동의어를 AI가 제안합니다"
          >
            {aiPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            AI 추천 (숙박업계 기준)
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={save}
            disabled={busy || canonical.trim().length < 1}
          >
            {savePending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            저장
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────
// 그룹 1개 행 (인라인 편집)
// ─────────────────────────────────────────────────────────────────

function GroupRow({ group }: { group: GroupWithSynonyms }) {
  const router = useRouter();
  const confirm = useConfirmDialog();
  const [input, setInput] = useState('');
  const [pending, startTransition] = useTransition();
  const [aiPending, startAi] = useTransition();

  const existingTerms = group.synonyms.map((s) => s.term);

  const addOne = (raw: string) => {
    const term = raw.trim().replace(/,$/, '').trim();
    if (!term) return;
    if (term.toLowerCase() === group.canonicalTerm.toLowerCase()) {
      toast.warning('대표어는 자동 포함되므로 동의어로 넣을 필요 없습니다');
      return;
    }
    if (
      existingTerms.some((t) => t.toLowerCase() === term.toLowerCase())
    ) {
      toast.warning('이미 등록된 동의어입니다');
      return;
    }
    startTransition(async () => {
      const fd = new FormData();
      fd.set('groupId', group.id);
      fd.set('term', term);
      fd.set('language', 'ko');
      const res = await addSynonymAction(fd);
      if (res.ok) {
        toast.success(`"${term}" 추가됨`);
        setInput('');
        router.refresh();
      } else {
        toast.error(res.message ?? '추가 실패');
      }
    });
  };

  const removeSyn = (syn: TermSynonym) => {
    startTransition(async () => {
      const fd = new FormData();
      fd.set('id', syn.id);
      fd.set('groupId', group.id);
      const res = await removeSynonymAction(fd);
      if (res.ok) {
        toast.success(`"${syn.term}" 삭제됨`);
        router.refresh();
      } else {
        toast.error(res.message ?? '삭제 실패');
      }
    });
  };

  const runAi = () => {
    startAi(async () => {
      const res = await suggestSynonymsAction({
        canonicalTerm: group.canonicalTerm,
        existing: existingTerms,
      });
      if (res.ok && res.synonyms?.length) {
        let ok = 0;
        for (const term of res.synonyms) {
          const fd = new FormData();
          fd.set('groupId', group.id);
          fd.set('term', term);
          fd.set('language', 'ko');
          const r = await addSynonymAction(fd);
          if (r.ok) ok += 1;
        }
        toast.success(`AI 추천 ${ok}개 추가됨`);
        router.refresh();
      } else {
        toast.error(res.message ?? 'AI 제안 실패');
      }
    });
  };

  const deleteGroup = async () => {
    const ok = await confirm({
      title: '동의어 그룹 삭제',
      description: `"${group.canonicalTerm}" 그룹과 동의어 ${group.synonyms.length}개를 삭제합니다. 검색 확장에서 즉시 제외됩니다.`,
      tone: 'danger',
      confirmText: '삭제',
    });
    if (!ok) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set('id', group.id);
      fd.set('action', 'deactivate');
      const res = await toggleTermGroupAction(fd);
      if (res.ok) {
        toast.success(`"${group.canonicalTerm}" 삭제됨`);
        router.refresh();
      } else {
        toast.error(res.message ?? '삭제 실패');
      }
    });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (pending) return;
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addOne(input);
    }
  };

  const busy = pending || aiPending;

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {group.canonicalTerm}
            </span>
            <Badge tone="brand" className="text-[10px]">
              대표어
            </Badge>
            <span className="text-xs text-slate-400">
              동의어 {group.synonyms.length}개
            </span>
          </div>
          <button
            type="button"
            onClick={deleteGroup}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950/40 dark:hover:text-red-400"
            title="그룹 삭제"
          >
            <Trash2 className="h-3.5 w-3.5" />
            삭제
          </button>
        </div>

        {group.synonyms.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {group.synonyms.map((s) => (
              <button
                key={s.id}
                type="button"
                disabled={busy}
                onClick={() => removeSyn(s)}
                className="group inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700 transition hover:border-red-300 hover:bg-red-50 hover:text-red-700 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200 dark:hover:border-red-700 dark:hover:bg-red-950/40 dark:hover:text-red-300"
                title={`${s.term} — 클릭하여 삭제`}
              >
                <span>{s.term}</span>
                <X className="h-3 w-3 opacity-40 group-hover:opacity-100" />
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="동의어 추가 (Enter·쉼표)"
              disabled={busy}
              maxLength={60}
              className="h-9"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => addOne(input)}
            disabled={busy || input.trim().length < 1}
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            추가
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={runAi}
            disabled={busy}
            title="이 대표어 기준 숙박업계 동의어를 AI가 추가합니다"
          >
            {aiPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            AI 추천
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
