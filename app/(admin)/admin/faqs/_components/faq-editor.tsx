'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Save } from 'lucide-react';
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
            <span className="text-xs text-slate-500">
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

function FieldError({ msg }: { msg: string }) {
  return <span className="text-xs text-rose-600">{msg}</span>;
}
