'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition, type ReactNode } from 'react';
import { Eye, Save, Sparkles, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { MarkdownView } from '@/components/articles/markdown-view';
import { useConfirmDialog } from '@/components/dialogs/confirm-dialog';
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

  const [activeTab, setActiveTab] = useState<'edit' | 'preview' | 'split'>(
    'split',
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

      {/* 본문 split view */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-5">
          <div className="flex items-center justify-between">
            <Label>본문 (Markdown) *</Label>
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
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={24}
                placeholder={`## 제목\n\n본문을 마크다운으로 작성하세요.\n\n## 다음 섹션\n\n- 리스트도 가능\n- ## / ### 헤딩은 자동 TOC 생성`}
                className="font-mono text-sm"
              />
            )}
            {(activeTab === 'preview' || activeTab === 'split') && (
              <div className="min-h-[24rem] overflow-auto rounded-md border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950">
                {body.trim() ? (
                  <MarkdownView source={body} />
                ) : (
                  <p className="text-sm text-slate-400">
                    본문을 입력하면 이곳에 미리보기가 표시됩니다.
                  </p>
                )}
              </div>
            )}
          </div>
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
