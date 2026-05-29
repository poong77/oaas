/**
 * 검색 키워드 동의어 확장 헬퍼.
 *
 * `expandKeywords(input)` 는 입력 쿼리를 토큰화한 뒤 동의어 사전에서
 * 정확 일치(Q-1)하는 그룹을 찾아 해당 그룹의 모든 term을 OR 확장한다.
 *
 * 호출처:
 *   - lib/services/articles.ts (searchArticles, listArticles)
 *   - lib/services/faqs.ts (searchFaqs)
 *   - lib/services/notices.ts (searchNotices)
 *   - lib/services/tickets.ts (listTickets)
 */

import 'server-only';

import { loadSynonymIndex } from './master-synonyms';
import { tokenizeQuery } from '@/lib/text/normalize';

export type ExpandKeywordsOptions = {
  /** 결과 토큰 상한 (안전장치). 기본 64. */
  maxTokens?: number;
};

/**
 * 입력 키워드 → 동의어 OR 확장.
 *
 * 알고리즘 (Q-1 정확 일치, Q-2 lower+trim, Q-3 2자 이상):
 *   1. tokenizeQuery(input) → tokens (lower+trim, 2자 이상 필터)
 *   2. 각 token을 termToGroupIds에서 정확 매칭
 *   3. 매칭된 그룹의 [canonical, ...synonyms] 수집
 *   4. 원본 input + 토큰 + 확장 토큰 dedupe 반환
 *
 * 매칭 없으면 원본 토큰만 반환 (확장 0).
 *
 * @example
 *   await expandKeywords('CI') // ['CI', 'ci', '체크인', 'check-in', '입실', ...]
 *   await expandKeywords('하우스키핑') // ['하우스키핑', '객실 청소', 'housekeeping', 'HK', ...]
 *   await expandKeywords('전혀모르는단어') // ['전혀모르는단어'] (확장 없음)
 *   await expandKeywords('') // []
 */
export async function expandKeywords(
  input: string,
  options: ExpandKeywordsOptions = {},
): Promise<string[]> {
  const maxTokens = Math.max(1, options.maxTokens ?? 64);
  const trimmed = (input ?? '').trim();
  if (!trimmed) return [];

  const tokens = tokenizeQuery(trimmed);
  // 원본도 함께 보존 (UI 표시 / 짧은 단어 검색 호환)
  const result = new Set<string>();
  result.add(trimmed);
  for (const t of tokens) result.add(t);

  if (tokens.length === 0) return Array.from(result);

  try {
    const index = await loadSynonymIndex();
    for (const tok of tokens) {
      const groupIds = index.termToGroupIds.get(tok);
      if (!groupIds) continue;
      for (const gid of groupIds) {
        const terms = index.groupIdToTerms.get(gid) ?? [];
        for (const t of terms) {
          result.add(t);
          if (result.size >= maxTokens) break;
        }
        if (result.size >= maxTokens) break;
      }
      if (result.size >= maxTokens) break;
    }
  } catch (err) {
    // 확장 실패해도 원본 토큰으로 검색 fallback
    console.warn(
      '[synonym-expander.expandKeywords] 확장 실패, 원본 토큰만 사용:',
      err instanceof Error ? err.message : err,
    );
  }

  return Array.from(result);
}

/**
 * 추천 카테고리 매칭 (P1 — category-suggester).
 *
 * 입력 텍스트에서 매칭된 그룹들의 `suggestedCategoryId`를 빈도순으로 반환.
 *
 * @example
 *   suggestCategoriesFromText("PMS 결제 안됨")
 *   // → [{ categoryId: 'cat-product-pms-uuid', hits: 1 }, { categoryId: 'cat-issue-error-uuid', hits: 1 }]
 */
export async function suggestCategoriesFromText(
  text: string,
  options: { limit?: number } = {},
): Promise<{ categoryId: string; hits: number }[]> {
  const limit = Math.max(1, options.limit ?? 3);
  const trimmed = (text ?? '').trim();
  if (!trimmed) return [];

  const tokens = tokenizeQuery(trimmed);
  if (tokens.length === 0) return [];

  try {
    const index = await loadSynonymIndex();
    const hits = new Map<string, number>();

    for (const tok of tokens) {
      const groupIds = index.termToGroupIds.get(tok);
      if (!groupIds) continue;
      for (const gid of groupIds) {
        const catId = index.groupIdToSuggestedCategoryId.get(gid);
        if (!catId) continue;
        hits.set(catId, (hits.get(catId) ?? 0) + 1);
      }
    }

    return Array.from(hits.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([categoryId, hitCount]) => ({ categoryId, hits: hitCount }));
  } catch (err) {
    console.warn(
      '[synonym-expander.suggestCategoriesFromText] 실패:',
      err instanceof Error ? err.message : err,
    );
    return [];
  }
}
