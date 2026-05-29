'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Save, Sparkles, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { useConfirmDialog } from '@/components/dialogs/confirm-dialog';
import { RichEditor } from '@/components/editor/rich-editor';
import { deleteDraftAfterPublish } from '@/lib/editor/draft-client';
import type { ProductCategoryView } from '@/lib/services/categories';
import {
  checkSlugAvailable,
  createArticleAction,
  generateArticleSlug,
  updateArticleAction,
} from '@/app/actions/article-actions';

type EditorMode = 'create' | 'edit';

type InitialValues = {
  id: string;
  productCode: string;
  categoryPath: string[] | null;
  slug: string;
  title: string;
  summary30s: string;
  bodyMarkdown: string;
  relatedArticleIds: string[] | null;
  isPublished: boolean;
};

export function ArticleEditor({
  mode,
  categories,
  initial,
}: {
  mode: EditorMode;
  categories: ProductCategoryView[];
  initial?: InitialValues;
}) {
  const router = useRouter();
  const confirm = useConfirmDialog();
  const [pending, startTransition] = useTransition();

  const [productCode, setProductCode] = useState(
    initial?.productCode ?? categories[0]?.code ?? '',
  );
  const [categoryPath, setCategoryPath] = useState(
    initial?.categoryPath?.join(' > ') ?? '',
  );
  const [title, setTitle] = useState(initial?.title ?? '');
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [summary, setSummary] = useState(initial?.summary30s ?? '');
  const [body, setBody] = useState(initial?.bodyMarkdown ?? '');
  const [related, setRelated] = useState(
    initial?.relatedArticleIds?.join(', ') ?? '',
  );

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function handleSuggestSlug() {
    if (!title.trim()) {
      toast.info('먼저 제목을 입력해주세요.');
      return;
    }
    const result = await generateArticleSlug(title.trim());
    setSlug(result.slug);
    toast.success(`slug 자동 생성: ${result.slug}`);
  }

  async function handleCheckSlug() {
    if (!slug.trim()) {
      toast.info('slug를 먼저 입력하세요.');
      return;
    }
    if (!/^[a-z0-9-]+$/.test(slug)) {
      toast.error('slug는 영문 소문자/숫자/하이픈만 가능합니다.');
      return;
    }
    const { available } = await checkSlugAvailable(
      slug,
      mode === 'edit' ? initial?.id : undefined,
    );
    if (available) toast.success('사용 가능한 slug 입니다.');
    else toast.error('이미 사용 중인 slug 입니다.');
  }

  async function submit(publish: boolean) {
    setFieldErrors({});

    // 발행 전 확인
    if (publish) {
      const ok = await confirm({
        title: '아티클을 발행하시겠습니까?',
        description:
          '발행 즉시 호텔리어에게 노출됩니다. 추후 편집 시에는 즉시 반영됩니다.',
        confirmText: '발행',
      });
      if (!ok) return;
    }

    const formData = new FormData();
    formData.set('productCode', productCode);
    formData.set('categoryPath', categoryPath);
    formData.set('slug', slug.toLowerCase().trim());
    formData.set('title', title.trim());
    formData.set('summary30s', summary.trim());
    formData.set('bodyMarkdown', body);
    formData.set('relatedArticleIds', related);
    formData.set('publishMode', publish ? 'publish' : 'draft');

    startTransition(async () => {
      const result =
        mode === 'create'
          ? await createArticleAction(undefined, formData)
          : await updateArticleAction(initial!.id, undefined, formData);

      if (result.ok && result.id) {
        await deleteDraftAfterPublish('article', initial?.id ?? null);
        toast.success(
          mode === 'create'
            ? publish
              ? '발행되었습니다'
              : 'Draft로 저장되었습니다'
            : '저장되었습니다',
        );
        if (mode === 'create') {
          router.push(`/admin/articles/${result.id}`);
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
      {/* 메타 정보 폼 */}
      <Card>
        <CardContent className="grid gap-4 p-5 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="productCode">제품 *</Label>
            <Select
              id="productCode"
              value={productCode}
              onChange={(e) => setProductCode(e.target.value)}
            >
              {categories.map((c) => (
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
            <Label htmlFor="categoryPath">카테고리 경로 (선택)</Label>
            <Input
              id="categoryPath"
              value={categoryPath}
              onChange={(e) => setCategoryPath(e.target.value)}
              placeholder="예: 결제 > 오류"
            />
            <span className="text-xs text-slate-500">
              {'>'} 로 구분합니다. 비워두면 카테고리 없음.
            </span>
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="title">제목 *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
            />
            {fieldErrors.title && <FieldError msg={fieldErrors.title} />}
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="slug">Slug (URL) *</Label>
            <div className="flex flex-wrap gap-2">
              <Input
                id="slug"
                value={slug}
                onChange={(e) =>
                  setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))
                }
                placeholder="예: pms-payment-error"
                maxLength={120}
                className="flex-1 min-w-0"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSuggestSlug}
                disabled={pending}
              >
                <Sparkles className="h-3.5 w-3.5" />
                자동 생성
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCheckSlug}
                disabled={pending}
              >
                중복 확인
              </Button>
            </div>
            <span className="text-xs text-slate-500">
              영문 소문자, 숫자, 하이픈만 가능. 한 번 발행한 slug는 변경 시
              SEO 영향이 있습니다.
            </span>
            {fieldErrors.slug && <FieldError msg={fieldErrors.slug} />}
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="summary30s">30초 요약 (선택)</Label>
            <Textarea
              id="summary30s"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="이 문서를 30초 안에 이해할 수 있는 핵심 요약 (200자 내외 권장)"
            />
            <span className="text-xs text-slate-500">
              {summary.length} / 500
            </span>
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="related">관련 문서 ID (선택)</Label>
            <Input
              id="related"
              value={related}
              onChange={(e) => setRelated(e.target.value)}
              placeholder="UUID를 쉼표(,)로 구분"
            />
            <span className="text-xs text-slate-500">
              없으면 자동으로 같은 제품의 최근 발행 아티클을 추천합니다.
            </span>
          </div>
        </CardContent>
      </Card>

      {/* 본문 RichEditor */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-5">
          <Label>본문 *</Label>
          <RichEditor
            mode="full"
            value={body}
            onChange={setBody}
            minHeight={480}
            placeholder="아티클 본문을 작성하세요. ## / ### 헤딩은 자동 TOC 생성."
            autoSave={{
              scope: 'article',
              targetId: initial?.id ?? null,
            }}
          />
          {fieldErrors.bodyMarkdown && (
            <FieldError msg={fieldErrors.bodyMarkdown} />
          )}
        </CardContent>
      </Card>

      {/* 액션 */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => submit(false)}
          disabled={pending}
        >
          <Save className="h-4 w-4" />
          Draft 저장
        </Button>
        <Button
          type="button"
          onClick={() => submit(true)}
          disabled={pending}
        >
          <Upload className="h-4 w-4" />
          {mode === 'edit' && initial?.isPublished
            ? '저장 + 재발행'
            : '발행하기'}
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
