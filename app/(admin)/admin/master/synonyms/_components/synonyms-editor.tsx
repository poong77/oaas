'use client';

/**
 * 동의어 inline 편집기 — 그룹 상세 페이지 하단.
 * Design §6.5.
 *
 * 기능:
 *   - 입력 박스 + Enter/쉼표 추가
 *   - 칩 클릭 시 삭제 (confirm 후 soft delete)
 *   - 언어 토글 (ko/en)
 *   - 중복 입력 토스트
 *   - 추가/삭제 후 router.refresh
 */

import { useState, useTransition, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  addSynonymAction,
  removeSynonymAction,
} from '@/app/actions/master-synonyms-actions';
import type { TermSynonym } from '@/db/schema';

type Props = {
  groupId: string;
  synonyms: TermSynonym[];
  canonicalTerm: string;
};

export function SynonymsEditor({ groupId, synonyms, canonicalTerm }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [input, setInput] = useState('');
  const [language, setLanguage] = useState<'ko' | 'en'>('ko');

  const submit = (raw: string) => {
    const term = raw.trim().replace(/,$/, '').trim();
    if (!term) return;
    if (term.length < 2) {
      toast.warning('2자 이상 입력해주세요 (검색 매칭 최소 길이)');
      return;
    }
    if (term === canonicalTerm) {
      toast.warning('대표어는 자동 포함되므로 동의어로 추가할 필요 없습니다');
      return;
    }
    const exists = synonyms.some(
      (s) => s.term === term && s.language === language,
    );
    if (exists) {
      toast.warning('이미 등록된 동의어입니다');
      return;
    }

    startTransition(async () => {
      const fd = new FormData();
      fd.set('groupId', groupId);
      fd.set('term', term);
      fd.set('language', language);
      const result = await addSynonymAction(fd);
      if (result.ok) {
        toast.success(`"${term}" 추가됨`);
        setInput('');
        router.refresh();
      } else {
        toast.error(result.message ?? '추가 실패');
      }
    });
  };

  const remove = (synonym: TermSynonym) => {
    if (!confirm(`"${synonym.term}" 동의어를 삭제하시겠어요?`)) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set('id', synonym.id);
      fd.set('groupId', groupId);
      const result = await removeSynonymAction(fd);
      if (result.ok) {
        toast.success(`"${synonym.term}" 삭제됨`);
        router.refresh();
      } else {
        toast.error(result.message ?? '삭제 실패');
      }
    });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (pending) return;
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      submit(input);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold">
          동의어{' '}
          <span className="text-slate-500 dark:text-slate-400">({synonyms.length}개)</span>
        </Label>
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span>대표어 "{canonicalTerm}"는 자동 포함</span>
        </div>
      </div>

      {synonyms.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-center text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
          아직 동의어가 없습니다. 아래 입력 박스에서 추가하세요.
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {synonyms.map((s) => (
            <button
              key={s.id}
              type="button"
              disabled={pending}
              onClick={() => remove(s)}
              className="group inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs text-brand-700 transition hover:border-red-300 hover:bg-red-50 hover:text-red-700 disabled:opacity-50 dark:border-brand-800 dark:bg-brand-950/40 dark:text-brand-300 dark:hover:border-red-700 dark:hover:bg-red-950/40 dark:hover:text-red-300"
              title={`${s.term} (${s.language}) — 클릭하여 삭제`}
            >
              <span>{s.term}</span>
              <Badge tone="slate" className="px-1 text-[9px]">
                {s.language}
              </Badge>
              <X className="h-3 w-3 opacity-50 group-hover:opacity-100" />
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-1 flex-col gap-1">
          <Label htmlFor="new-synonym" className="text-xs">
            새 동의어
          </Label>
          <Input
            id="new-synonym"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="예: CI, check-in, 입실"
            disabled={pending}
            maxLength={60}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="new-synonym-lang" className="text-xs">
            언어
          </Label>
          <Select
            id="new-synonym-lang"
            value={language}
            onChange={(e) => setLanguage(e.target.value as 'ko' | 'en')}
            disabled={pending}
          >
            <option value="ko">한국어</option>
            <option value="en">영어</option>
          </Select>
        </div>
        <Button
          type="button"
          onClick={() => submit(input)}
          disabled={pending || input.trim().length < 2}
          size="sm"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          추가
        </Button>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Enter 또는 쉼표(,)로 빠르게 추가. 칩 클릭 시 삭제.
      </p>
    </div>
  );
}
