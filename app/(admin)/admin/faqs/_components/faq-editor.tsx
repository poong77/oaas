'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Save, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { RichEditor } from '@/components/editor/rich-editor';
import { deleteDraftAfterPublish } from '@/lib/editor/draft-client';
import type { ProductCategoryView } from '@/lib/services/categories';
import {
  createFaqAction,
  suggestFaqKeywordsAction,
  updateFaqAction,
} from '@/app/actions/faq-actions';

type EditorMode = 'create' | 'edit';

type InitialValues = {
  id: string;
  productCode: string;
  issueType: string | null;
  question: string;
  answerMarkdown: string;
  keywords: string[];
  sortOrder: number;
};

export function FaqEditor({
  mode,
  productCategories,
  issueTypeCategories,
  initial,
  defaultQuestion,
}: {
  mode: EditorMode;
  productCategories: ProductCategoryView[];
  issueTypeCategories: Array<{ code: string; label: string }>;
  initial?: InitialValues;
  /** v1.7 — 생성 모드에서 질문 프리필 (0건 검색어 → FAQ 작성 연결). */
  defaultQuestion?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [productCode, setProductCode] = useState(
    initial?.productCode ?? productCategories[0]?.code ?? '',
  );
  const [issueType, setIssueType] = useState(initial?.issueType ?? '');
  const [question, setQuestion] = useState(
    initial?.question ?? defaultQuestion ?? '',
  );
  const [answer, setAnswer] = useState(initial?.answerMarkdown ?? '');
  const [keywords, setKeywords] = useState<string[]>(initial?.keywords ?? []);
  const [keywordDraft, setKeywordDraft] = useState('');
  const [aiPending, setAiPending] = useState(false);
  const [sortOrder, setSortOrder] = useState(
    initial?.sortOrder !== undefined ? String(initial.sortOrder) : '0',
  );

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function addKeyword(raw?: string) {
    const k = (raw ?? keywordDraft).trim();
    if (!k) return;
    setKeywords((prev) => {
      if (prev.length >= 30) return prev;
      if (prev.some((x) => x.toLowerCase() === k.toLowerCase())) return prev;
      return [...prev, k.slice(0, 60)];
    });
    setKeywordDraft('');
  }

  function removeKeyword(k: string) {
    setKeywords((prev) => prev.filter((x) => x !== k));
  }

  async function suggestKeywords() {
    if (question.trim().length < 2) {
      toast.error('질문을 먼저 입력하세요');
      return;
    }
    setAiPending(true);
    try {
      const res = await suggestFaqKeywordsAction({
        question: question.trim(),
        answer,
        existing: keywords,
      });
      if (res.ok && res.keywords) {
        const added = res.keywords.filter(
          (k) => !keywords.some((x) => x.toLowerCase() === k.toLowerCase()),
        );
        if (added.length === 0) {
          toast.info('추가할 새 키워드가 없어요');
        } else {
          setKeywords((prev) => [...prev, ...added].slice(0, 30));
          toast.success(`AI가 키워드 ${added.length}개를 제안했어요`);
        }
      } else {
        toast.error(res.message ?? 'AI 제안 실패');
      }
    } finally {
      setAiPending(false);
    }
  }

  function submit() {
    setFieldErrors({});
    const formData = new FormData();
    formData.set('productCode', productCode);
    formData.set('issueType', issueType);
    formData.set('question', question.trim());
    formData.set('answerMarkdown', answer);
    formData.set('keywords', keywords.join(','));
    formData.set('sortOrder', sortOrder.trim() || '0');

    startTransition(async () => {
      const result =
        mode === 'create'
          ? await createFaqAction(undefined, formData)
          : await updateFaqAction(initial!.id, undefined, formData);

      if (result.ok && result.id) {
        await deleteDraftAfterPublish('faq', initial?.id ?? null);
        toast.success(mode === 'create' ? 'FAQ가 생성되었습니다' : '저장되었습니다');
        if (mode === 'create') {
          router.push(`/admin/faqs/${result.id}`);
        } else {
          router.refresh();
        }
      } else {
        if (result.fieldErrors) setFieldErrors(result.fieldErrors);
        toast.error(result.message ?? '저장 실패');
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardContent className="grid gap-4 p-5 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="productCode">제품 *</Label>
            <Select
              id="productCode"
              value={productCode}
              onChange={(e) => setProductCode(e.target.value)}
            >
              {productCategories.map((c) => (
                <option key={c.id} value={c.code}>
                  {c.label}
                </option>
              ))}
            </Select>
            {fieldErrors.productCode && (
              <FieldError msg={fieldErrors.productCode} />
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="issueType">문제유형 (선택)</Label>
            <Select
              id="issueType"
              value={issueType}
              onChange={(e) => setIssueType(e.target.value)}
            >
              <option value="">선택 안 함</option>
              {issueTypeCategories.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="question">질문 *</Label>
            <Input
              id="question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              maxLength={300}
              placeholder="호텔리어가 자주 묻는 질문"
            />
            {fieldErrors.question && (
              <FieldError msg={fieldErrors.question} />
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sortOrder">정렬순</Label>
            <Input
              id="sortOrder"
              type="number"
              min="0"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              placeholder="0 (작을수록 위)"
            />
            <span className="text-xs text-slate-500 dark:text-slate-400">
              같은 제품 내에서 작을수록 위에 표시. 10 단위 권장.
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3 p-5">
          <Label>답변 *</Label>
          <RichEditor
            mode="full"
            value={answer}
            onChange={setAnswer}
            minHeight={320}
            placeholder="답변을 작성하세요. 짧고 명확하게, 단계가 있으면 번호 매김, 관련 링크 적극 활용."
            autoSave={{
              scope: 'faq',
              targetId: initial?.id ?? null,
            }}
          />
          {fieldErrors.answerMarkdown && (
            <FieldError msg={fieldErrors.answerMarkdown} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3 p-5">
          <div className="flex items-center justify-between gap-2">
            <Label>검색 키워드 (선택)</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={suggestKeywords}
              disabled={aiPending}
            >
              <Sparkles className="h-3.5 w-3.5" />
              {aiPending ? '제안 중...' : 'AI 추천'}
            </Button>
          </div>

          {keywords.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {keywords.map((k) => (
                <span
                  key={k}
                  className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  {k}
                  <button
                    type="button"
                    onClick={() => removeKeyword(k)}
                    className="text-slate-400 dark:text-slate-500 hover:text-rose-600"
                    aria-label={`${k} 삭제`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <Input
              value={keywordDraft}
              onChange={(e) => setKeywordDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addKeyword();
                }
              }}
              placeholder="키워드 추가 후 Enter (예: 도어락 오류, 키리스)"
              maxLength={60}
            />
            <Button type="button" variant="outline" onClick={() => addKeyword()}>
              추가
            </Button>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            질문에 없는 다른 표현을 보강하면 검색이 더 잘 잡혀요. 영문 약어·외국어는
            여기 대신{' '}
            <a
              href="/admin/master/synonyms"
              className="underline hover:text-slate-700"
            >
              동의어 마스터
            </a>
            에 등록하세요.
          </span>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={submit} disabled={pending}>
          <Save className="h-4 w-4" />
          {mode === 'create' ? '저장 + 노출' : '저장'}
        </Button>
        {pending && (
          <span className="text-xs text-slate-500 dark:text-slate-400">저장 중...</span>
        )}
      </div>
    </div>
  );
}

function FieldError({ msg }: { msg: string }) {
  return <span className="text-xs text-rose-600 dark:text-rose-400">{msg}</span>;
}
