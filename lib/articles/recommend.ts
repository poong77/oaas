/**
 * 키워드 / 관련 문서 추천 알고리즘.
 *
 * Phase 1 (현재): 타입 + skeleton (다른 컴포넌트가 import 가능)
 * Phase 2 (예정): 실제 구현
 *   - recommendKeywords: term_synonyms + 본문 토큰 + 인기 키워드 (viewCount × 0.7 + helpfulYes × 0.3)
 *   - recommendRelatedArticles: 같은 카테고리 + 키워드 교집합 + 본문 마크다운 링크
 *
 * @see docs/02-design/knowledge-base-overhaul/DESIGN.md §4-1
 */

import 'server-only';

export type KeywordRecommendation = {
  term: string;
  source: 'synonym' | 'body-extract' | 'popular';
  groupId?: string;
  weight: number;
};

export type RelatedArticleRecommendation = {
  id: string;
  slug: string;
  title: string;
  productCode: string;
  reason: 'same-category' | 'keyword-overlap' | 'body-link';
  weight: number;
};

export type RecommendKeywordsInput = {
  title: string;
  body: string;
  productCode: string;
  existing: string[];
};

export type RecommendRelatedInput = {
  productCode: string;
  categoryPath: string[];
  keywords: string[];
  body: string;
  excludeId?: string;
};

/**
 * Phase 2에서 구현. 현재는 빈 배열 반환 (UI 컴포넌트가 안전하게 마운트 가능).
 */
export async function recommendKeywords(
  _input: RecommendKeywordsInput,
): Promise<KeywordRecommendation[]> {
  return [];
}

/**
 * Phase 2에서 구현.
 */
export async function recommendRelatedArticles(
  _input: RecommendRelatedInput,
): Promise<RelatedArticleRecommendation[]> {
  return [];
}
