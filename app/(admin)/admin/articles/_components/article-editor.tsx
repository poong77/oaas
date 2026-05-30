'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { AlertTriangle, CheckCircle2, Save, Sparkles, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useConfirmDialog } from '@/components/dialogs/confirm-dialog';
import { RichEditor } from '@/components/editor/rich-editor';
import { deleteDraftAfterPublish } from '@/lib/editor/draft-client';
import type { ProductCategoryView } from '@/lib/services/categories';
import {
  validateBody,
  validateTitle,
  validateSummary,
} from '@/lib/articles/body-validator';
import {
  checkSlugAvailable,
  createArticleAction,
  generateArticleSlug,
  updateArticleAction,
} from '@/app/actions/article-actions';
import type { ArticleContentType } from '@/db/schema';

type EditorMode = 'create' | 'edit';

type InitialValues = {
  id: string;
  productCode: string;
  contentType: ArticleContentType;
  categoryPath: string[] | null;
  slug: string;
  title: string;
  summary: string;
  summary30s: string;
  keywords: string[];
  bodyMarkdown: string;
  relatedSlugs: string[];
  relatedArticleIds: string[] | null;
  isPublished: boolean;
};

const CONTENT_TYPE_OPTIONS: Array<{
  value: ArticleContentType;
  label: string;
  description: string;
  tone: 'brand' | 'success' | 'warn';
}> = [
  { value: 'howto', label: '사용방법', description: '따라하기 — 동작형 제목', tone: 'brand' },
  { value: 'feature', label: '기능설명', description: '이해하기 — 명사구 제목', tone: 'success' },
  { value: 'troubleshoot', label: '문제해결', description: '고치기 — 증상형 제목', tone: 'warn' },
];

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
  const [contentType, setContentType] = useState<ArticleContentType>(
    initial?.contentType ?? 'howto',
  );
  const [categoryPath, setCategoryPath] = useState(
    initial?.categoryPath?.join(' > ') ?? '',
  );
  const [title, setTitle] = useState(initial?.title ?? '');
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [summary, setSummary] = useState(
    initial?.summary ?? initial?.summary30s ?? '',
  );
  const [body, setBody] = useState(initial?.bodyMarkdown ?? '');
  const [keywords, setKeywords] = useState<string[]>(initial?.keywords ?? []);
  const [keywordDraft, setKeywordDraft] = useState('');
  const [related, setRelated] = useState(
    initial?.relatedSlugs?.length
      ? initial.relatedSlugs.join(', ')
      : initial?.relatedArticleIds?.join(', ') ?? '',
  );

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // 실시간 검증 — 발행 차단 errors + 자기완결/제목/요약 워닝
  const validation = useMemo(() => {
    const { errors, warnings } = validateBody(body, contentType);
    const titleW = validateTitle(title).warnings;
    const summaryW = validateSummary(summary).warnings;
    const allWarnings = [...warnings, ...titleW, ...summaryW];
    if (keywords.length < 3) {
      allWarnings.push('키워드 3개 이상 권장 — 검색 매칭률 향상');
    }
    return { errors, warnings: allWarnings };
  }, [body, contentType, title, summary, keywords.length]);

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

    // 발행 전 검증 — errors 있으면 차단 (Q-9)
    if (publish && validation.errors.length > 0) {
      toast.error(
        `발행 차단: ${validation.errors[0]} (총 ${validation.errors.length}건)`,
      );
      return;
    }

    // 발행 전 확인
    if (publish) {
      const ok = await confirm({
        title: '아티클을 발행하시겠습니까?',
        description:
          validation.warnings.length > 0
            ? `워닝 ${validation.warnings.length}건이 있습니다. 그래도 발행할까요?`
            : '발행 즉시 호텔리어에게 노출됩니다. 추후 편집 시에는 즉시 반영됩니다.',
        confirmText: '발행',
      });
      if (!ok) return;
    }

    const formData = new FormData();
    formData.set('productCode', productCode);
    formData.set('contentType', contentType);
    formData.set('categoryPath', categoryPath);
    formData.set('slug', slug.toLowerCase().trim());
    formData.set('title', title.trim());
    formData.set('summary', summary.trim());
    // summary30s 호환 (Q-13): 백엔드가 summary 비어 있으면 summary30s를 사용
    formData.set('summary30s', summary.trim());
    formData.set('bodyMarkdown', body);
    formData.set('keywords', keywords.join(','));
    formData.set('relatedArticleIds', related);
    // relatedSlugs: 입력값이 slug 패턴이면 양쪽 모두 사용
    const relatedSlugCandidates = related
      .split(',')
      .map((s) => s.trim())
      .filter((s) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s));
    formData.set('relatedSlugs', relatedSlugCandidates.join(','));
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

  function addKeyword() {
    const v = keywordDraft.trim();
    if (!v || keywords.includes(v) || keywords.length >= 30) return;
    setKeywords([...keywords, v]);
    setKeywordDraft('');
  }
  function removeKeyword(k: string) {
    setKeywords(keywords.filter((x) => x !== k));
  }

  return (
    <div className="flex flex-col gap-5">
      {/* content_type 선택 — 사용자 의도 분류 */}
      <Card>
        <CardContent className="p-5">
          <Label className="mb-2 block">
            사용자 의도 (content_type) <span className="text-red-500">*</span>
          </Label>
          <div className="grid gap-2 sm:grid-cols-3">
            {CONTENT_TYPE_OPTIONS.map((o) => {
              const selected = contentType === o.value;
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setContentType(o.value)}
                  className={`flex flex-col items-start gap-1 rounded-md border px-3 py-2.5 text-left transition ${
                    selected
                      ? 'border-brand-500 bg-brand-50 dark:border-brand-400 dark:bg-brand-950/40'
                      : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <Badge tone={o.tone} className="text-[10px]">
                      {o.value}
                    </Badge>
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {o.label}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {o.description}
                  </span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 검증 패널 — 발행 가드 + 워닝 */}
      <Card
        className={
          validation.errors.length > 0
            ? 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-950/30'
            : validation.warnings.length > 0
              ? 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30'
              : 'border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/30'
        }
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            {validation.errors.length > 0 ? (
              <AlertTriangle className="h-5 w-5 shrink-0 text-red-600 dark:text-red-300" />
            ) : validation.warnings.length > 0 ? (
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-300" />
            ) : (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-300" />
            )}
            <div className="flex-1">
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {validation.errors.length > 0
                  ? `발행 차단 ${validation.errors.length}건`
                  : validation.warnings.length > 0
                    ? `워닝 ${validation.warnings.length}건 — 저장은 가능합니다`
                    : '검증 통과 — 발행 가능'}
              </div>
              {validation.errors.length > 0 && (
                <ul className="mt-1.5 list-disc pl-5 text-xs text-red-700 dark:text-red-300">
                  {validation.errors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              )}
              {validation.warnings.length > 0 && (
                <ul className="mt-1.5 list-disc pl-5 text-xs text-amber-700 dark:text-amber-300">
                  {validation.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

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
            <Label htmlFor="categoryPath">메뉴 경로 (menu_path)</Label>
            <Input
              id="categoryPath"
              value={categoryPath}
              onChange={(e) => setCategoryPath(e.target.value)}
              placeholder="예: 예약 관리 > 예약 등록"
            />
            <span className="text-xs text-slate-500">
              {'>'} 로 구분. menu_taxonomies 마스터의 라벨 경로와 일치해야 함 (1~3단계).
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
            <Label htmlFor="summary">요약 (summary) — 30초 요약 + 검색용</Label>
            <Textarea
              id="summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={2}
              maxLength={2000}
              placeholder="이 문서를 30초 안에 이해할 수 있는 핵심 요약 (200자 내외 권장, 2000자까지)"
            />
            <span className="text-xs text-slate-500">
              {summary.length} / 2000 {summary.length > 200 && '· 200자 권장'}
            </span>
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label>키워드 (keywords) *</Label>
            <div className="flex flex-wrap gap-1.5">
              {keywords.map((k) => (
                <span
                  key={k}
                  className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2 py-0.5 text-xs text-brand-700 dark:bg-brand-900/40 dark:text-brand-300"
                >
                  {k}
                  <button
                    type="button"
                    onClick={() => removeKeyword(k)}
                    className="hover:text-brand-900 dark:hover:text-brand-100"
                    aria-label={`${k} 삭제`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
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
                placeholder="키워드 추가 (예: 체크인, CI, check-in)"
                maxLength={60}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addKeyword}
                disabled={!keywordDraft.trim() || keywords.length >= 30}
              >
                추가
              </Button>
            </div>
            <span className="text-xs text-slate-500">
              {keywords.length} / 30 · 동의어·약어·UI 라벨 포함 권장 (synonyms-master로 자동 확장됨)
            </span>
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="related">관련 문서 slug (선택)</Label>
            <Input
              id="related"
              value={related}
              onChange={(e) => setRelated(e.target.value)}
              placeholder="예: pms-reservation-create-single, pms-status-glossary"
            />
            <span className="text-xs text-slate-500">
              slug 쉼표(,) 구분. (uuid도 호환되나 신규는 slug 권장)
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
