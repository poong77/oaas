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
import { Sparkles, X } from 'lucide-react';
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
  generateArticleSlug,
} from '@/app/actions/article-actions';
import { MenuPathCascader } from './menu-path-cascader';

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
    // 현재 generateArticleSlug 시그니처는 title 받음 (호환 유지).
    // Phase 1 Step C에서 generateOpsIdSlug(productCode, contentType)로 교체 예정.
    const result = await generateArticleSlug(title.trim() || productCode);
    onSlug(result.slug);
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
      mode === 'edit' ? initialId : undefined,
    );
    if (available) toast.success('사용 가능한 slug 입니다.');
    else toast.error('이미 사용 중인 slug 입니다.');
  }

  function addKeyword() {
    const v = keywordDraft.trim();
    if (!v || keywords.includes(v) || keywords.length >= 30) return;
    onKeywords([...keywords, v]);
    setKeywordDraft('');
  }
  function removeKeyword(k: string) {
    onKeywords(keywords.filter((x) => x !== k));
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
          <Label htmlFor="slug">
            Slug (URL) * — 운영 ID 권장: <code>{productCode || '{product}'}-{contentType}-001</code>
          </Label>
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
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="summary">요약 (summary) — 30초 요약 + 검색용</Label>
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
            {keywords.length} / 30 · Phase 2에서 동의어 자동 추천 추가 예정.
          </span>
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="related">관련 문서 slug (선택)</Label>
          <Input
            id="related"
            value={related}
            onChange={(e) => onRelated(e.target.value)}
            placeholder="예: pms-howto-001, pms-feature-013"
          />
          <span className="text-xs text-slate-500">
            slug 쉼표(,) 구분. Phase 2에서 자동 추천 + 검색 자동완성 추가 예정.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function FieldError({ msg }: { msg: string }) {
  return <span className="text-xs text-rose-600">{msg}</span>;
}
