'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition, type ReactNode } from 'react';
import { Eye, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { MarkdownView } from '@/components/articles/markdown-view';
import type { ProductCategoryView } from '@/lib/services/categories';
import {
  createFaqAction,
  updateFaqAction,
} from '@/app/actions/faq-actions';

type EditorMode = 'create' | 'edit';

type InitialValues = {
  id: string;
  productCode: string;
  issueType: string | null;
  question: string;
  answerMarkdown: string;
  sortOrder: number;
};

export function FaqEditor({
  mode,
  productCategories,
  issueTypeCategories,
  initial,
}: {
  mode: EditorMode;
  productCategories: ProductCategoryView[];
  issueTypeCategories: Array<{ code: string; label: string }>;
  initial?: InitialValues;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [productCode, setProductCode] = useState(
    initial?.productCode ?? productCategories[0]?.code ?? '',
  );
  const [issueType, setIssueType] = useState(initial?.issueType ?? '');
  const [question, setQuestion] = useState(initial?.question ?? '');
  const [answer, setAnswer] = useState(initial?.answerMarkdown ?? '');
  const [sortOrder, setSortOrder] = useState(
    initial?.sortOrder !== undefined ? String(initial.sortOrder) : '0',
  );

  const [activeTab, setActiveTab] = useState<'edit' | 'preview' | 'split'>(
    'split',
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function submit() {
    setFieldErrors({});
    const formData = new FormData();
    formData.set('productCode', productCode);
    formData.set('issueType', issueType);
    formData.set('question', question.trim());
    formData.set('answerMarkdown', answer);
    formData.set('sortOrder', sortOrder.trim() || '0');

    startTransition(async () => {
      const result =
        mode === 'create'
          ? await createFaqAction(undefined, formData)
          : await updateFaqAction(initial!.id, undefined, formData);

      if (result.ok && result.id) {
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
            <span className="text-xs text-slate-500">
              같은 제품 내에서 작을수록 위에 표시. 10 단위 권장.
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3 p-5">
          <div className="flex items-center justify-between">
            <Label>답변 (Markdown) *</Label>
            <div className="flex items-center gap-1 rounded-md border border-slate-200 p-0.5 text-xs dark:border-slate-700">
              <TabButton
                active={activeTab === 'edit'}
                onClick={() => setActiveTab('edit')}
              >
                작성
              </TabButton>
              <TabButton
                active={activeTab === 'split'}
                onClick={() => setActiveTab('split')}
              >
                양쪽
              </TabButton>
              <TabButton
                active={activeTab === 'preview'}
                onClick={() => setActiveTab('preview')}
              >
                <Eye className="h-3 w-3" />
                미리보기
              </TabButton>
            </div>
          </div>

          <div
            className={
              activeTab === 'split'
                ? 'grid gap-3 lg:grid-cols-2'
                : 'grid gap-3'
            }
          >
            {(activeTab === 'edit' || activeTab === 'split') && (
              <Textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                rows={16}
                placeholder={'답변을 마크다운으로 작성하세요.\n\n- 짧고 명확하게\n- 단계가 있으면 번호 매김\n- 관련 링크 적극 활용'}
                className="font-mono text-sm"
              />
            )}
            {(activeTab === 'preview' || activeTab === 'split') && (
              <div className="min-h-[20rem] overflow-auto rounded-md border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950">
                {answer.trim() ? (
                  <MarkdownView source={answer} />
                ) : (
                  <p className="text-sm text-slate-400">
                    답변을 입력하면 미리보기가 표시됩니다.
                  </p>
                )}
              </div>
            )}
          </div>
          {fieldErrors.answerMarkdown && (
            <FieldError msg={fieldErrors.answerMarkdown} />
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={submit} disabled={pending}>
          <Save className="h-4 w-4" />
          {mode === 'create' ? '저장 + 노출' : '저장'}
        </Button>
        {pending && (
          <span className="text-xs text-slate-500">저장 중...</span>
        )}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded px-2 py-1 font-medium transition-colors ${
        active
          ? 'bg-brand-600 text-white'
          : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
      }`}
    >
      {children}
    </button>
  );
}

function FieldError({ msg }: { msg: string }) {
  return <span className="text-xs text-rose-600">{msg}</span>;
}
