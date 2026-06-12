'use client';

/**
 * ai-reply-assist — AI 모델 마스터 인라인 편집기 (admin).
 *
 * 행별: 표시명/설명/등급 인라인 수정, 기본값 지정, 활성 토글, 정렬(위/아래). 하단 신규 추가.
 * 4행 안팎의 작은 세트라 단일 페이지 인라인 편집이 별도 CRUD 페이지보다 효율적.
 *
 * @see docs/02-design/features/ai-reply-assist.design.md §8.2
 */

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Plus,
  Save,
  Star,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import {
  createAiModelAction,
  updateAiModelAction,
  toggleAiModelActiveAction,
  setAiModelDefaultAction,
  reorderAiModelsAction,
} from '@/app/actions/master-ai-models-actions';

type Provider = 'anthropic' | 'openai';
type Tier = 'economy' | 'balanced' | 'premium';

export type ManagerModel = {
  id: string;
  provider: Provider;
  code: string;
  label: string;
  description: string | null;
  tier: Tier;
  isDefault: boolean;
  isActive: boolean;
  sortOrder: number;
};

const PROVIDER_TONE: Record<Provider, 'brand' | 'success'> = {
  anthropic: 'brand',
  openai: 'success',
};
const TIER_TONE: Record<Tier, 'slate' | 'brand' | 'warn'> = {
  economy: 'slate',
  balanced: 'brand',
  premium: 'warn',
};
const TIERS: Tier[] = ['economy', 'balanced', 'premium'];

export function AiModelsManager({
  initialModels,
}: {
  initialModels: ManagerModel[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // 행별 편집 로컬 상태 (표시명/설명/등급)
  const [edits, setEdits] = useState<Record<string, Partial<ManagerModel>>>({});
  useEffect(() => setEdits({}), [initialModels]);

  const sorted = [...initialModels].sort((a, b) => a.sortOrder - b.sortOrder);

  function run(fn: () => Promise<{ ok: boolean; message?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        setError(res.message ?? '처리 실패');
        return;
      }
      router.refresh();
    });
  }

  function field<K extends keyof ManagerModel>(m: ManagerModel, key: K): ManagerModel[K] {
    const e = edits[m.id];
    return (e && key in e ? (e[key] as ManagerModel[K]) : m[key]);
  }
  function setField(id: string, key: keyof ManagerModel, value: unknown) {
    setEdits((p) => ({ ...p, [id]: { ...p[id], [key]: value } }));
  }
  function isDirty(m: ManagerModel): boolean {
    const e = edits[m.id];
    if (!e) return false;
    return (
      (e.label !== undefined && e.label !== m.label) ||
      (e.description !== undefined && (e.description ?? '') !== (m.description ?? '')) ||
      (e.tier !== undefined && e.tier !== m.tier)
    );
  }

  function saveRow(m: ManagerModel) {
    run(() =>
      updateAiModelAction({
        id: m.id,
        label: field(m, 'label') as string,
        description: (field(m, 'description') as string | null) || null,
        tier: field(m, 'tier') as Tier,
      }),
    );
  }

  function move(m: ManagerModel, dir: -1 | 1) {
    const idx = sorted.findIndex((x) => x.id === m.id);
    const swap = sorted[idx + dir];
    if (!swap) return;
    run(() =>
      reorderAiModelsAction({
        order: [
          { id: m.id, sortOrder: swap.sortOrder },
          { id: swap.id, sortOrder: m.sortOrder },
        ],
      }),
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-950/30 dark:text-red-400">
          {error}
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {sorted.map((m, i) => (
          <li
            key={m.id}
            className={cn(
              'flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-start',
              m.isActive
                ? 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'
                : 'border-dashed border-slate-200 bg-slate-50/60 opacity-70 dark:border-slate-800 dark:bg-slate-900/40',
            )}
          >
            {/* 정렬 */}
            <div className="flex shrink-0 flex-row gap-1 sm:flex-col">
              <button
                type="button"
                onClick={() => move(m, -1)}
                disabled={i === 0 || pending}
                className="rounded border border-slate-200 p-0.5 text-slate-400 dark:text-slate-500 hover:text-slate-600 disabled:opacity-30 dark:border-slate-700"
                aria-label="위로"
              >
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => move(m, 1)}
                disabled={i === sorted.length - 1 || pending}
                className="rounded border border-slate-200 p-0.5 text-slate-400 dark:text-slate-500 hover:text-slate-600 disabled:opacity-30 dark:border-slate-700"
                aria-label="아래로"
              >
                <ArrowDown className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* 본문 */}
            <div className="flex flex-1 flex-col gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge tone={PROVIDER_TONE[m.provider]}>{m.provider}</Badge>
                <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                  {m.code}
                </span>
                {m.isDefault && (
                  <Badge tone="warn" className="gap-0.5">
                    <Star className="h-3 w-3" /> 기본
                  </Badge>
                )}
              </div>

              <label className="flex flex-col gap-0.5">
                <span className="text-[11px] text-slate-400 dark:text-slate-500">표시명 (모달 노출)</span>
                <input
                  value={field(m, 'label') as string}
                  onChange={(e) => setField(m.id, 'label', e.target.value)}
                  className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
                />
              </label>
              <label className="flex flex-col gap-0.5">
                <span className="text-[11px] text-slate-400 dark:text-slate-500">설명 (1M 단가·특성)</span>
                <input
                  value={(field(m, 'description') as string | null) ?? ''}
                  onChange={(e) => setField(m.id, 'description', e.target.value)}
                  className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-950"
                />
              </label>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1">
                  {TIERS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setField(m.id, 'tier', t)}
                      className={cn(
                        'rounded-full px-2 py-0.5 text-xs',
                        (field(m, 'tier') as Tier) === t
                          ? 'ring-1 ring-brand-400'
                          : 'opacity-60 hover:opacity-100',
                      )}
                    >
                      <Badge tone={TIER_TONE[t]}>{t}</Badge>
                    </button>
                  ))}
                </div>
                {isDirty(m) && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => saveRow(m)}
                    disabled={pending}
                  >
                    <Save className="h-3.5 w-3.5" /> 저장
                  </Button>
                )}
              </div>
            </div>

            {/* 우측 제어 */}
            <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end">
              <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                활성
                <Switch
                  checked={m.isActive}
                  disabled={pending}
                  aria-label="활성 토글"
                  onCheckedChange={(v) =>
                    run(() => toggleAiModelActiveAction({ id: m.id, isActive: v }))
                  }
                />
              </label>
              <button
                type="button"
                disabled={m.isDefault || !m.isActive || pending}
                onClick={() => run(() => setAiModelDefaultAction({ id: m.id }))}
                className={cn(
                  'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium',
                  m.isDefault
                    ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-300'
                    : 'border-slate-200 text-slate-500 dark:text-slate-400 hover:border-amber-300 hover:text-amber-600 disabled:opacity-40 dark:border-slate-700',
                )}
                title={!m.isActive ? '활성 모델만 기본 지정 가능' : undefined}
              >
                {m.isDefault ? <Check className="h-3 w-3" /> : <Star className="h-3 w-3" />}
                {m.isDefault ? '기본 모델' : '기본 지정'}
              </button>
            </div>
          </li>
        ))}
      </ul>

      <NewModelForm pending={pending} onCreate={(input) => run(() => createAiModelAction(input))} />
    </div>
  );
}

function NewModelForm({
  pending,
  onCreate,
}: {
  pending: boolean;
  onCreate: (input: {
    provider: Provider;
    code: string;
    label: string;
    description?: string;
    tier: Tier;
  }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState<Provider>('anthropic');
  const [code, setCode] = useState('');
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [tier, setTier] = useState<Tier>('balanced');

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex w-fit items-center gap-1 rounded-md border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-500 dark:text-slate-400 hover:border-brand-300 hover:text-brand-600 dark:border-slate-700"
      >
        <Plus className="h-4 w-4" /> 모델 추가
      </button>
    );
  }

  function submit() {
    if (!code.trim() || !label.trim()) return;
    onCreate({
      provider,
      code: code.trim(),
      label: label.trim(),
      description: description.trim() || undefined,
      tier,
    });
    setCode('');
    setLabel('');
    setDescription('');
    setOpen(false);
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-brand-200 bg-brand-50/30 p-3 dark:border-brand-900 dark:bg-brand-950/10">
      <div className="text-xs font-semibold text-brand-700 dark:text-brand-300">
        새 모델 추가
      </div>
      <div className="flex flex-wrap gap-2">
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value as Provider)}
          className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
        >
          <option value="anthropic">anthropic</option>
          <option value="openai">openai</option>
        </select>
        <select
          value={tier}
          onChange={(e) => setTier(e.target.value as Tier)}
          className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
        >
          {TIERS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="API 모델 ID (예: gpt-4.1-mini)"
          className="min-w-[180px] flex-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-mono dark:border-slate-700 dark:bg-slate-950"
        />
      </div>
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="표시명 (예: GPT-4.1 mini · 약 2.6원/건)"
        className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
      />
      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="설명 (예: 입$0.40·출$1.60/1M · 빠름·저비용)"
        className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-950"
      />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
          취소
        </Button>
        <Button type="button" size="sm" onClick={submit} disabled={pending}>
          <Plus className="h-3.5 w-3.5" /> 추가
        </Button>
      </div>
    </div>
  );
}
