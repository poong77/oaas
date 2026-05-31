'use client';

/**
 * EditorMetaForm — 메타 정보 폼 (productCode, slug, title, summary, keywords, related, categoryPath).
 *
 * Phase 1: 기본 입력 + MenuPathCascader 통합.
 * Phase 2: KeywordRecommender + RelatedArticleAutocomplete 통합 (현재 자리만 마련, 단순 입력).
 *
 * @see docs/02-design/knowledge-base-overhaul/DESIGN.md §1-1
 */

import { useState } from 'react';
import Link from 'next/link';
import { Sparkles, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import type { ProductCategoryView } from '@/lib/services/categories';
import type { ArticleContentType } from '@/db/schema';
import {
  checkSlugAvailable,
  generateOpsIdSlugAction,
} from '@/app/actions/article-actions';
import {
  isKoreanKeyword,
  KOREAN_KEYWORD_REJECT_MESSAGE,
} from '@/lib/articles/keyword-filter';
import { MenuPathCascader } from './menu-path-cascader';
import { KeywordRecommender } from './keyword-recommender';
import { RelatedArticleAutocomplete } from './related-article-autocomplete';
import { KbAiSuggestionCard } from './ai-assistant-panel';
import type { AiAssistOutput } from '@/lib/ai/prompts/article-assistant';

export interface EditorMetaFormProps {
  mode: 'create' | 'edit';
  initialId?: string;
  categories: ProductCategoryView[];
  contentType: ArticleContentType;

  productCode: string;
  categoryPath: string[];
  title: string;
  slug: string;
  summary: string;
  keywords: string[];
  related: string;
  /** A3 추천에서 사용할 본문 컨텍스트 (shell에서 전달). */
  bodyForRecommend?: string;
  /** A5 AI 제안 (각 필드 옆 mini 카드 inline 표시). */
  aiSuggestion?: AiAssistOutput | null;
  /** AI 호출 트리거 (각 필드 라벨 옆 ✨ 버튼). */
  onTriggerAi?: () => void;
  /** AI 호출 진행 중. true면 모든 ✨ 버튼 spinner. */
  aiLoading?: boolean;
  /** AI 호출 가능 여부 (본문 500자+ 또는 제목 입력). */
  aiAvailable?: boolean;
  onAiApplySlug?: () => void;
  onAiRejectSlug?: () => void;
  onAiApplySummary?: () => void;
  onAiRejectSummary?: () => void;
  onAiApplyKeywords?: () => void;
  onAiRejectKeywords?: () => void;
  onAiApplyRelatedHints?: () => void;
  onAiRejectRelatedHints?: () => void;

  onProductCode: (v: string) => void;
  onCategoryPath: (v: string[]) => void;
  onTitle: (v: string) => void;
  onSlug: (v: string) => void;
  onSummary: (v: string) => void;
  onKeywords: (v: string[]) => void;
  onRelated: (v: string) => void;

  fieldErrors: Record<string, string>;
}

export function EditorMetaForm({
  mode,
  initialId,
  categories,
  contentType,
  productCode,
  categoryPath,
  title,
  slug,
  summary,
  keywords,
  related,
  bodyForRecommend = '',
  aiSuggestion,
  onTriggerAi,
  aiLoading = false,
  aiAvailable = true,
  onAiApplySlug,
  onAiRejectSlug,
  onAiApplySummary,
  onAiRejectSummary,
  onAiApplyKeywords,
  onAiRejectKeywords,
  onAiApplyRelatedHints,
  onAiRejectRelatedHints,
  onProductCode,
  onCategoryPath,
  onTitle,
  onSlug,
  onSummary,
  onKeywords,
  onRelated,
  fieldErrors,
}: EditorMetaFormProps) {
  const [keywordDraft, setKeywordDraft] = useState('');

  async function handleSuggestSlug() {
    if (!productCode) {
      toast.info('먼저 제품을 선택해주세요.');
      return;
    }
    const result = await generateOpsIdSlugAction(productCode, contentType);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    onSlug(result.slug);
    toast.success(`운영 ID 채번 완료: ${result.slug} (seq=${result.seq})`);
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
      mode === 'edit' ? initialId : undefined,
    );
    if (available) toast.success('사용 가능한 slug 입니다.');
    else toast.error('이미 사용 중인 slug 입니다.');
  }

  function addKeyword() {
    const v = keywordDraft.trim();
    if (!v) return;
    if (keywords.includes(v)) {
      toast.info('이미 추가된 키워드예요.');
      return;
    }
    if (keywords.length >= 30) {
      toast.error('키워드는 최대 30개까지 가능합니다.');
      return;
    }
    if (!isKoreanKeyword(v)) {
      toast.error(KOREAN_KEYWORD_REJECT_MESSAGE);
      return;
    }
    onKeywords([...keywords, v]);
    setKeywordDraft('');
  }
  function removeKeyword(k: string) {
    onKeywords(keywords.filter((x) => x !== k));
  }

  // 각 필드 라벨 옆 ✨ 트리거 버튼 (재사용)
  function AiTriggerBtn({ field }: { field: 'slug' | 'summary' | 'keywords' | 'related' }) {
    if (!onTriggerAi) return null;
    return (
      <button
        type="button"
        onClick={onTriggerAi}
        disabled={!aiAvailable || aiLoading}
        title={
          !aiAvailable
            ? '본문 500자 또는 제목 입력 후 활성'
            : `${field} 자동 작성 — 5종 한 번에 추출`
        }
        className={`inline-flex h-6 items-center gap-1 rounded-md border px-2 text-[10px] font-medium transition ${
          aiAvailable && !aiLoading
            ? 'border-brand-300 bg-brand-50 text-brand-700 hover:bg-brand-100 dark:border-brand-700 dark:bg-brand-950/40 dark:text-brand-300'
            : 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed dark:border-slate-700 dark:bg-slate-800'
        }`}
      >
        {aiLoading ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Sparkles className="h-3 w-3" />
        )}
        AI 자동
      </button>
    );
  }

  return (
    <Card>
      <CardContent className="grid gap-4 p-5 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="productCode">제품 *</Label>
          <Select
            id="productCode"
            value={productCode}
            onChange={(e) => onProductCode(e.target.value)}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.code}>
                {c.label}
              </option>
            ))}
          </Select>
          {fieldErrors.productCode && <FieldError msg={fieldErrors.productCode} />}
        </div>

        <div className="sm:col-span-2">
          <MenuPathCascader
            productCode={productCode}
            value={categoryPath}
            onChange={onCategoryPath}
          />
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="title">제목 *</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => onTitle(e.target.value)}
            maxLength={200}
          />
          {fieldErrors.title && <FieldError msg={fieldErrors.title} />}
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="slug">
              Slug (URL) * — 운영 ID 권장: <code>{productCode || '{product}'}-{contentType}-001</code>
            </Label>
            <AiTriggerBtn field="slug" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Input
              id="slug"
              value={slug}
              onChange={(e) =>
                onSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))
              }
              placeholder={`예: ${productCode || 'pms'}-${contentType}-001`}
              maxLength={120}
              className="flex-1 min-w-0"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSuggestSlug}
            >
              <Sparkles className="h-3.5 w-3.5" />
              자동 생성
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleCheckSlug}
            >
              중복 확인
            </Button>
          </div>
          {fieldErrors.slug && <FieldError msg={fieldErrors.slug} />}
          <KbAiSuggestionCard
            value={aiSuggestion?.slug}
            onApply={() => onAiApplySlug?.()}
            onReject={() => onAiRejectSlug?.()}
            label="slug 제안"
            mono
          />
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="summary">요약 (summary) — 30초 요약 + 검색용</Label>
            <AiTriggerBtn field="summary" />
          </div>
          <Textarea
            id="summary"
            value={summary}
            onChange={(e) => onSummary(e.target.value)}
            rows={2}
            maxLength={2000}
            placeholder="이 문서를 30초 안에 이해할 수 있는 핵심 요약 (200자 내외 권장, 2000자까지)"
          />
          <span className="text-xs text-slate-500">
            {summary.length} / 2000 {summary.length > 200 && '· 200자 권장'}
          </span>
          <KbAiSuggestionCard
            value={aiSuggestion?.summary}
            onApply={() => onAiApplySummary?.()}
            onReject={() => onAiRejectSummary?.()}
            label="summary 제안"
          />
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <div className="flex items-center justify-between">
            <Label>키워드 (keywords) *</Label>
            <AiTriggerBtn field="keywords" />
          </div>
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
              placeholder="키워드 추가 (예: 체크인, 예약 등록) — 한글만"
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
            {keywords.length} / 30 · 한글만 가능 · 영어 약어/동의어는{' '}
            <Link
              href="/admin/master/synonyms"
              target="_blank"
              className="underline hover:text-brand-600"
            >
              동의어 사전
            </Link>{' '}
            마스터에 등록
          </span>
          <KeywordRecommender
            inputContext={{
              title,
              body: bodyForRecommend,
              productCode,
            }}
            current={keywords}
            onAdd={(k) => {
              if (!keywords.includes(k) && keywords.length < 30) {
                onKeywords([...keywords, k]);
              }
            }}
          />
          <KbAiSuggestionCard
            value={
              aiSuggestion?.keywords && aiSuggestion.keywords.length > 0
                ? aiSuggestion.keywords.join(', ')
                : undefined
            }
            onApply={() => onAiApplyKeywords?.()}
            onReject={() => onAiRejectKeywords?.()}
            label={`keywords 제안 (${aiSuggestion?.keywords?.length ?? 0}개 일괄)`}
          />
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <div className="flex items-center justify-between">
            <Label>관련 문서 (선택)</Label>
            <AiTriggerBtn field="related" />
          </div>
          <RelatedArticleAutocomplete
            inputContext={{
              productCode,
              categoryPath,
              keywords,
              body: bodyForRecommend,
              excludeId: mode === 'edit' ? initialId : undefined,
            }}
            rawValue={related}
            onChange={onRelated}
          />
          <span className="text-xs text-slate-500">
            slug 쉼표(,) 구분. 검색 또는 추천 칩에서 클릭으로 추가하세요.
          </span>
          <KbAiSuggestionCard
            value={
              aiSuggestion?.related_search_hints &&
              aiSuggestion.related_search_hints.length > 0
                ? aiSuggestion.related_search_hints.join(', ')
                : undefined
            }
            onApply={() => onAiApplyRelatedHints?.()}
            onReject={() => onAiRejectRelatedHints?.()}
            label="관련 검색어 제안 → keywords로 병합"
          />
        </div>
      </CardContent>
    </Card>
  );
}

function FieldError({ msg }: { msg: string }) {
  return <span className="text-xs text-rose-600">{msg}</span>;
}
