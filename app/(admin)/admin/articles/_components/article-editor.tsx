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
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { Eye, Save, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { savePreview } from '@/lib/articles/preview-store';
import { Button } from '@/components/ui/button';
import { useConfirmDialog } from '@/components/dialogs/confirm-dialog';
import {
  validateBody,
  validateTitle,
  validateSummary,
  extractBodyOutline,
  isPlaceholderOnly,
  hardCheck,
} from '@/lib/articles/body-validator';
import { getTemplateBody } from '@/lib/articles/templates';
import {
  useAutosaveStatus,
  type AutosaveStatus,
} from '@/lib/editor/use-autosave-status';
import { deleteDraftAfterPublish } from '@/lib/editor/draft-client';
import {
  createArticleAction,
  updateArticleAction,
  resolveArticleTemplateAction,
} from '@/app/actions/article-actions';
import type { ResolvedTemplate } from '@/lib/services/master-article-templates';
import type { ProductCategoryView } from '@/lib/services/categories';
import type { ArticleContentType } from '@/db/schema';

import { IntentSelector } from './editor/intent-selector';
import { EditorMetaForm } from './editor/editor-meta-form';
import { EditorBody } from './editor/editor-body';
import {
  ArticleChecklistSidebar,
  type MetaCheck,
} from './editor/article-checklist-sidebar';
import { KbAiChatbotMetaCard } from './editor/ai-assistant-panel';
import type { AiAssistOutput } from '@/lib/ai/prompts/article-assistant';
import { aiAssistArticleAction } from '@/app/actions/article-actions';

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
    const { warnings } = validateBody(body, contentType);
    const allWarnings = [
      ...warnings,
      ...validateTitle(title).warnings,
      ...validateSummary(summary).warnings,
    ];
    if (keywords.length < 3) {
      allWarnings.push('키워드 3개 이상 권장 — 검색 매칭률 향상');
    }
    if (categoryPath.length === 0) {
      allWarnings.push('메뉴 경로 미선택 — /help 사이드바 트리에 노출 안 됨');
    }
    return { errors: [] as string[], warnings: allWarnings };
  }, [body, contentType, title, summary, keywords.length, categoryPath.length]);

  // v1.5 — Hard 검증 (발행 차단). 워닝과는 별개.
  const hard = useMemo(
    () => hardCheck({ productCode, contentType, title, slug, bodyMarkdown: body }),
    [productCode, contentType, title, slug, body],
  );

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

  // 자동저장 토글 + 상태 동기 (UI는 사이드바에서, 실제 저장은 RichEditor 내부)
  const autosave = useAutosaveStatus(initial?.id ?? null);
  const handleAutosaveChange = useCallback(
    (
      saveStatus:
        | 'idle'
        | 'saving'
        | 'saved'
        | 'offline'
        | 'error',
    ) => {
      const mapped: Exclude<AutosaveStatus, 'off'> =
        saveStatus === 'offline' ? 'dirty' : saveStatus;
      autosave.reportStatus(mapped);
    },
    [autosave],
  );

  // AI 제안 결과 (각 필드 옆 mini 카드로 분산 표시)
  const [aiSuggestion, setAiSuggestion] = useState<AiAssistOutput | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiCooldownUntil, setAiCooldownUntil] = useState(0);

  const aiAvailable =
    !!productCode &&
    (title.trim().length > 0 || body.length >= 500) &&
    Date.now() >= aiCooldownUntil;

  async function handleTriggerAi() {
    if (!aiAvailable || aiLoading) return;
    setAiLoading(true);
    try {
      const result = await aiAssistArticleAction({
        title,
        body,
        contentType,
        productCode,
        categoryPath,
        existingKeywords: keywords,
      });
      if (!result.ok) {
        toast.error(result.message);
        if (result.reason === 'rate-limit') {
          setAiCooldownUntil(Date.now() + 60_000);
        }
        return;
      }
      if (result.truncated) {
        toast.info(
          `본문이 길어 5000자만 분석했어요 (원본 ${result.originalLength?.toLocaleString()}자).`,
        );
      }
      setAiSuggestion(result.data);
      toast.success('AI 제안이 각 필드 옆에 표시됐어요. 적용/거부를 선택하세요.');
    } finally {
      setAiLoading(false);
    }
  }

  function dismissField(field: 'slug' | 'summary' | 'keywords' | 'relatedHints' | 'chatbotMeta') {
    setAiSuggestion((prev) => {
      if (!prev) return null;
      const next = { ...prev };
      if (field === 'slug') (next as { slug?: string }).slug = '';
      else if (field === 'summary') (next as { summary?: string }).summary = '';
      else if (field === 'keywords') (next as { keywords?: string[] }).keywords = [];
      else if (field === 'relatedHints')
        (next as { related_search_hints?: string[] }).related_search_hints = [];
      else if (field === 'chatbotMeta')
        (next as { chatbot_meta?: AiAssistOutput['chatbot_meta'] | null }).chatbot_meta = null as never;
      return next;
    });
  }

  // 골격 마스터 (DB 우선, 폴백 코드 상수) — 마운트 시 3종 fetch
  const [templates, setTemplates] = useState<
    Partial<Record<ArticleContentType, ResolvedTemplate>>
  >({});
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      resolveArticleTemplateAction('howto'),
      resolveArticleTemplateAction('feature'),
      resolveArticleTemplateAction('troubleshoot'),
    ])
      .then(([h, f, t]) => {
        if (cancelled) return;
        setTemplates({ howto: h, feature: f, troubleshoot: t });
      })
      .catch(() => {
        // 폴백: 코드 상수 (handleIntentChange가 getTemplateBody로 처리)
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function templateBody(t: ArticleContentType): string {
    return templates[t]?.bodyMarkdown ?? getTemplateBody(t);
  }

  // 의도 변경 핸들러 (A1)
  async function handleIntentChange(next: ArticleContentType) {
    if (next === contentType) return;

    // 빈 본문(골격만) → 즉시 골격 주입
    if (isPlaceholderOnly(body)) {
      setContentType(next);
      setBody(templateBody(next));
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
    if (ok) setBody(templateBody(next));
  }

  function handleOpenPreview() {
    if (!productCode) {
      toast.error('제품을 선택해야 미리볼 수 있어요.');
      return;
    }
    if (title.trim().length === 0) {
      toast.error('제목을 입력해야 미리볼 수 있어요.');
      return;
    }
    if (body.trim().length === 0 || isPlaceholderOnly(body)) {
      toast.error('본문을 입력해야 미리볼 수 있어요.');
      return;
    }

    try {
      const productLabel =
        categories.find((c) => c.code === productCode)?.label ?? productCode;
      const nonce = savePreview({
        productCode,
        productLabel,
        contentType,
        categoryPath,
        title: title.trim(),
        slug: slug.trim() || 'preview',
        summary: summary.trim(),
        keywords,
        bodyMarkdown: body,
        authorName: null,
        isPublishedSource: initial?.isPublished ?? false,
      });
      const url = `/articles-preview?key=${encodeURIComponent(nonce)}`;
      // noopener 를 쓰면 window.open 반환값이 항상 null 이라 팝업 차단 감지 불가.
      // 같은 origin 의 내부 어드민 경로이므로 noopener 없이 호출하고, 반환값으로 차단 감지.
      const opened = window.open(url, '_blank');
      if (!opened) {
        toast.error('팝업이 차단됐어요. 브라우저 팝업 허용 후 다시 시도해주세요.');
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : '미리보기 준비 중 오류가 발생했어요.',
      );
    }
  }

  async function submit(publish: boolean) {
    setFieldErrors({});

    // v1.5 — Hard 검증만 차단. 워닝은 안내 후 발행 가능.
    if (publish && !hard.ok) {
      toast.error(
        `발행 차단: ${hard.errors[0]} (총 ${hard.errors.length}건)`,
      );
      return;
    }

    if (publish) {
      const ok = await confirm({
        title: '아티클을 발행하시겠습니까?',
        description:
          validation.warnings.length > 0
            ? `보완 권장 ${validation.warnings.length}건이 있어요. 발행 후에도 편집해서 보완할 수 있어요. 그래도 발행할까요?`
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
        // router 호출은 transition 밖에서 — refresh/push가 transition 안에
        // 들어가면 RSC fetch가 끝날 때까지 transition pending = navigation 차단.
        // setTimeout(0)으로 transition 콜백이 끝난 다음 tick에 실행되도록.
        const resultId = result.id;
        if (mode === 'create') {
          setTimeout(() => router.push(`/admin/articles/${resultId}`), 0);
        } else {
          setTimeout(() => router.refresh(), 0);
        }
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
          bodyForRecommend={body}
          aiSuggestion={aiSuggestion}
          onTriggerAi={handleTriggerAi}
          aiLoading={aiLoading}
          aiAvailable={aiAvailable}
          onAiApplySlug={() => {
            if (aiSuggestion?.slug) {
              setSlug(aiSuggestion.slug);
              dismissField('slug');
            }
          }}
          onAiRejectSlug={() => dismissField('slug')}
          onAiApplySummary={() => {
            if (aiSuggestion?.summary) {
              setSummary(aiSuggestion.summary);
              dismissField('summary');
            }
          }}
          onAiRejectSummary={() => dismissField('summary')}
          onAiApplyKeywords={() => {
            if (aiSuggestion?.keywords) {
              // v1.5 정책: 한글 키워드만 적용 (AI가 영어 섞어도 필터)
              const koreanOnly = aiSuggestion.keywords.filter((k) =>
                /[가-힣]/u.test(k) && !/[a-zA-Z]/.test(k),
              );
              const merged = Array.from(
                new Set([...keywords, ...koreanOnly]),
              ).slice(0, 30);
              setKeywords(merged);
              dismissField('keywords');
            }
          }}
          onAiRejectKeywords={() => dismissField('keywords')}
          onAiApplyRelatedHints={() => {
            // related_search_hints도 keywords와 동일 정책: 한글만 적용
            if (aiSuggestion?.related_search_hints) {
              const koreanOnly = aiSuggestion.related_search_hints.filter(
                (k) => /[가-힣]/u.test(k) && !/[a-zA-Z]/.test(k),
              );
              const merged = Array.from(
                new Set([...keywords, ...koreanOnly]),
              ).slice(0, 30);
              setKeywords(merged);
              dismissField('relatedHints');
            }
          }}
          onAiRejectRelatedHints={() => dismissField('relatedHints')}
          onProductCode={setProductCode}
          onCategoryPath={setCategoryPath}
          onTitle={setTitle}
          onSlug={setSlug}
          onSummary={setSummary}
          onKeywords={setKeywords}
          onRelated={setRelated}
          fieldErrors={fieldErrors}
        />

        {/* 챗봇 KB 메타는 별도 카드 (사이드 표시) */}
        {aiSuggestion?.chatbot_meta && (
          <KbAiChatbotMetaCard
            meta={aiSuggestion.chatbot_meta}
            onApply={() => {
              // v2 (Stream C)에서 articles.chatbot_meta JSONB 컬럼으로 영속화 예정.
              // v1은 draft에 보관 + 토스트만.
              dismissField('chatbotMeta');
            }}
            onReject={() => dismissField('chatbotMeta')}
          />
        )}

        <EditorBody
          value={body}
          onChange={setBody}
          autoSave={
            autosave.enabled
              ? { scope: 'article', targetId: initial?.id ?? null }
              : null
          }
          onAutosaveStatusChange={handleAutosaveChange}
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
            variant="outline"
            onClick={handleOpenPreview}
            disabled={pending}
            title="저장하지 않고 실제 도움말 페이지 모양으로 미리 봅니다 (새 탭, 10분 한정)."
          >
            <Eye className="h-4 w-4" />
            미리보기
          </Button>
          <Button
            type="button"
            onClick={() => submit(true)}
            disabled={pending || !hard.ok}
            title={!hard.ok ? `발행 차단: ${hard.errors.join(', ')}` : undefined}
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
