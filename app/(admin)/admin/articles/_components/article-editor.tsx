'use client';

/**
 * ArticleEditor shell (knowledge-base-overhaul Phase 1).
 *
 * 519줄 단일 컴포넌트 → 5개 하위 컴포넌트 조합 (Step B 결과).
 *
 * 책임:
 *   - 폼 상태 관리 (useState)
 *   - 의도 변경 시 ConfirmDialog + 본문 골격 주입
 *   - outline + validation 실시간 계산 (useMemo)
 *   - 자동저장 토글 상태 관리
 *   - submit (draft/publish) + ConfirmDialog
 *   - 좌측 메인 + 우측 사이드바 그리드 레이아웃
 *
 * 미해결 (v1.4 후속):
 *   - RichEditor 내부 autoSave 상태 ↔ 사이드바 표시 동기 (현재는 토글 + lastSavedAt만)
 *   - A7 generateOpsIdSlug 호출 통합 (현재 기존 generateArticleSlug 호환)
 *   - A1+ resolveArticleTemplate DB fetch (현재 코드 상수 폴백)
 *
 * @see docs/02-design/knowledge-base-overhaul/DESIGN.md §1-1
 */

import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { Save, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useConfirmDialog } from '@/components/dialogs/confirm-dialog';
import {
  validateBody,
  validateTitle,
  validateSummary,
  extractBodyOutline,
  isPlaceholderOnly,
} from '@/lib/articles/body-validator';
import { getTemplateBody } from '@/lib/articles/templates';
import { useAutosaveStatus } from '@/lib/editor/use-autosave-status';
import { deleteDraftAfterPublish } from '@/lib/editor/draft-client';
import {
  createArticleAction,
  updateArticleAction,
} from '@/app/actions/article-actions';
import type { ProductCategoryView } from '@/lib/services/categories';
import type { ArticleContentType } from '@/db/schema';

import { IntentSelector } from './editor/intent-selector';
import { EditorMetaForm } from './editor/editor-meta-form';
import { EditorBody } from './editor/editor-body';
import {
  ArticleChecklistSidebar,
  type MetaCheck,
} from './editor/article-checklist-sidebar';

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

const CONTENT_TYPE_LABEL: Record<ArticleContentType, string> = {
  howto: '사용방법',
  feature: '기능설명',
  troubleshoot: '문제해결',
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

  // 상태
  const [productCode, setProductCode] = useState(
    initial?.productCode ?? categories[0]?.code ?? '',
  );
  const [contentType, setContentType] = useState<ArticleContentType>(
    initial?.contentType ?? 'howto',
  );
  const [categoryPath, setCategoryPath] = useState<string[]>(
    initial?.categoryPath ?? [],
  );
  const [title, setTitle] = useState(initial?.title ?? '');
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [summary, setSummary] = useState(
    initial?.summary ?? initial?.summary30s ?? '',
  );
  const [body, setBody] = useState(
    initial?.bodyMarkdown ?? getTemplateBody(initial?.contentType ?? 'howto'),
  );
  const [keywords, setKeywords] = useState<string[]>(initial?.keywords ?? []);
  const [related, setRelated] = useState(
    initial?.relatedSlugs?.length
      ? initial.relatedSlugs.join(', ')
      : initial?.relatedArticleIds?.join(', ') ?? '',
  );

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // 실시간 검증 + outline
  const outline = useMemo(
    () => extractBodyOutline(body, contentType),
    [body, contentType],
  );
  const validation = useMemo(() => {
    const { errors, warnings } = validateBody(body, contentType);
    const allWarnings = [
      ...warnings,
      ...validateTitle(title).warnings,
      ...validateSummary(summary).warnings,
    ];
    if (keywords.length < 3) {
      allWarnings.push('키워드 3개 이상 권장 — 검색 매칭률 향상');
    }
    return { errors, warnings: allWarnings };
  }, [body, contentType, title, summary, keywords.length]);

  // 메타 체크리스트 (사이드바)
  const metaChecks: MetaCheck[] = [
    { label: '제품 선택', done: !!productCode },
    { label: '메뉴 경로', done: categoryPath.length > 0 },
    { label: '제목', done: title.trim().length > 0 },
    { label: 'Slug', done: slug.trim().length > 0 },
    { label: '요약', done: summary.trim().length > 0 },
    {
      label: '키워드 ≥ 3개',
      done: keywords.length >= 3,
      warn: keywords.length === 0 ? '0개' : undefined,
    },
  ];

  // 자동저장 토글 (UI는 사이드바에서, 실제 저장은 RichEditor 내부)
  const autosave = useAutosaveStatus(initial?.id ?? null);

  // 의도 변경 핸들러 (A1)
  async function handleIntentChange(next: ArticleContentType) {
    if (next === contentType) return;

    // 빈 본문(골격만) → 즉시 골격 주입
    if (isPlaceholderOnly(body)) {
      setContentType(next);
      setBody(getTemplateBody(next));
      return;
    }

    // 본문 존재 → confirm dialog
    const ok = await confirm({
      title: '본문이 있어요',
      description: `현재 본문이 작성돼 있습니다. ${CONTENT_TYPE_LABEL[next]} 골격으로 바꾸면 본문이 새 골격으로 덮어쓰여요. 의도만 바꾸고 본문은 유지하려면 [취소].`,
      confirmText: '덮어쓰기',
      cancelText: '의도만 바꾸기',
    });
    setContentType(next);
    if (ok) setBody(getTemplateBody(next));
  }

  async function submit(publish: boolean) {
    setFieldErrors({});

    if (publish && validation.errors.length > 0) {
      toast.error(
        `발행 차단: ${validation.errors[0]} (총 ${validation.errors.length}건)`,
      );
      return;
    }

    if (publish) {
      const ok = await confirm({
        title: '아티클을 발행하시겠습니까?',
        description:
          validation.warnings.length > 0
            ? `워닝 ${validation.warnings.length}건이 있습니다. 그래도 발행할까요?`
            : '발행 즉시 호텔리어에게 노출됩니다.',
        confirmText: '발행',
      });
      if (!ok) return;
    }

    const formData = new FormData();
    formData.set('productCode', productCode);
    formData.set('contentType', contentType);
    formData.set('categoryPath', categoryPath.join(' > '));
    formData.set('slug', slug.toLowerCase().trim());
    formData.set('title', title.trim());
    formData.set('summary', summary.trim());
    formData.set('summary30s', summary.trim());
    formData.set('bodyMarkdown', body);
    formData.set('keywords', keywords.join(','));
    formData.set('relatedArticleIds', related);
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
        if (mode === 'create') router.push(`/admin/articles/${result.id}`);
        else router.refresh();
      } else {
        if (result.fieldErrors) setFieldErrors(result.fieldErrors);
        toast.error(result.message ?? '저장 실패');
      }
    });
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
      <div className="flex min-w-0 flex-col gap-5">
        <IntentSelector
          value={contentType}
          onChange={(v) => void handleIntentChange(v)}
          disabled={pending}
        />

        <EditorMetaForm
          mode={mode}
          initialId={initial?.id}
          categories={categories}
          contentType={contentType}
          productCode={productCode}
          categoryPath={categoryPath}
          title={title}
          slug={slug}
          summary={summary}
          keywords={keywords}
          related={related}
          onProductCode={setProductCode}
          onCategoryPath={setCategoryPath}
          onTitle={setTitle}
          onSlug={setSlug}
          onSummary={setSummary}
          onKeywords={setKeywords}
          onRelated={setRelated}
          fieldErrors={fieldErrors}
        />

        <EditorBody
          value={body}
          onChange={setBody}
          autoSave={
            autosave.enabled
              ? { scope: 'article', targetId: initial?.id ?? null }
              : null
          }
          fieldError={fieldErrors.bodyMarkdown}
        />

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
            disabled={pending || validation.errors.length > 0}
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

      <aside className="lg:sticky lg:top-4 lg:self-start">
        <ArticleChecklistSidebar
          outline={outline}
          validation={validation}
          metaChecks={metaChecks}
          autosave={{
            status: autosave.status,
            lastSavedAt: autosave.lastSavedAt,
            enabled: autosave.enabled,
            onToggle: autosave.toggleEnabled,
          }}
        />
      </aside>
    </div>
  );
}
