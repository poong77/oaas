'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Save } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import type { ProductCategoryView } from '@/lib/services/categories';
import {
  createChecklistAction,
  updateChecklistAction,
} from '@/app/actions/checklist-actions';

type Mode = 'create' | 'edit';

type Initial = {
  id: string;
  productCode: string;
  issueType: string | null;
  title: string;
  description: string;
  sortOrder: number;
};

export function ChecklistMetaForm({
  mode,
  productCategories,
  issueTypeCategories,
  initial,
}: {
  mode: Mode;
  productCategories: ProductCategoryView[];
  issueTypeCategories: Array<{ code: string; label: string }>;
  initial?: Initial;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [productCode, setProductCode] = useState(
    initial?.productCode ?? productCategories[0]?.code ?? '',
  );
  const [issueType, setIssueType] = useState(initial?.issueType ?? '');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [sortOrder, setSortOrder] = useState(
    initial?.sortOrder !== undefined ? String(initial.sortOrder) : '0',
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function submit() {
    setFieldErrors({});
    const formData = new FormData();
    formData.set('productCode', productCode);
    formData.set('issueType', issueType);
    formData.set('title', title.trim());
    formData.set('description', description.trim());
    formData.set('sortOrder', sortOrder.trim() || '0');

    startTransition(async () => {
      const result =
        mode === 'create'
          ? await createChecklistAction(undefined, formData)
          : await updateChecklistAction(initial!.id, undefined, formData);
      if (result.ok && result.id) {
        toast.success(
          mode === 'create' ? '체크리스트가 생성되었습니다' : '저장되었습니다',
        );
        if (mode === 'create') {
          router.push(`/admin/checklists/${result.id}`);
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
            <span className="text-xs text-rose-600">
              {fieldErrors.productCode}
            </span>
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
          <Label htmlFor="title">제목 *</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            placeholder="예: PMS 결제 오류 트러블슈팅"
          />
          {fieldErrors.title && (
            <span className="text-xs text-rose-600">{fieldErrors.title}</span>
          )}
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="description">설명 (선택)</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
            rows={2}
            placeholder="한두 줄 설명. 카드뷰에 표시됩니다."
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sortOrder">정렬순</Label>
          <Input
            id="sortOrder"
            type="number"
            min="0"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
          />
          <span className="text-xs text-slate-500">
            작을수록 위. 10 단위 권장.
          </span>
        </div>

        <div className="flex items-end justify-end gap-2 sm:col-span-2">
          <Button onClick={submit} disabled={pending}>
            <Save className="h-4 w-4" />
            {mode === 'create' ? '저장하고 단계 편집' : '메타 저장'}
          </Button>
          {pending && (
            <span className="text-xs text-slate-500">저장 중...</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
