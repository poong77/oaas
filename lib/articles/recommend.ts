/**
 * 키워드 / 관련 문서 추천 알고리즘 (Phase 2).
 *
 * Phase 1: 타입 정의 + skeleton.
 * Phase 2: 실제 구현
 *   - recommendKeywords: term_synonyms 그룹 매칭 + 본문 토큰 추출
 *     (인기 키워드는 v1.5 보강 — articles.keywords aggregation)
 *   - recommendRelatedArticles: 같은 카테고리 + 키워드 교집합 + 본문 마크다운 링크
 *
 * @see docs/02-design/knowledge-base-overhaul/DESIGN.md §4-1
 */

import 'server-only';
import { and, desc, eq, ne, sql } from 'drizzle-orm';

import { db } from '@/db';
import { articles } from '@/db/schema';
import { loadSynonymIndex } from '@/lib/services/master-synonyms';
import { tokenizeQuery } from '@/lib/text/normalize';

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

// ─────────────────────────────────────────────────────────────────────────────
// recommendKeywords
// ─────────────────────────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  '있는',
  '있어요',
  '있다',
  '없는',
  '없어요',
  '없다',
  '같은',
  '같이',
  '입니다',
  '합니다',
  '하지만',
  '그리고',
  '또한',
  '되면',
  '되어',
  '으로',
  '에서',
  '에는',
]);

/**
 * 키워드 추천 — 동의어 그룹 매칭(weight 10) + 본문 빈도 토큰(weight 7).
 * 인기 키워드(weight = view*0.7 + helpful*0.3)는 v1.5 보강.
 *
 * 최대 7개 반환.
 */
export async function recommendKeywords({
  title,
  body,
  productCode: _productCode,
  existing,
}: RecommendKeywordsInput): Promise<KeywordRecommendation[]> {
  const text = `${title}\n${body}`.trim();
  if (!text) return [];

  const tokens = tokenizeQuery(text).filter(
    (t) => t.length >= 2 && !STOP_WORDS.has(t),
  );
  if (tokens.length === 0) return [];

  const existingSet = new Set(existing.map((e) => e.toLowerCase().trim()));
  const recs = new Map<string, KeywordRecommendation>();

  // 1) 동의어 그룹 매칭
  try {
    const index = await loadSynonymIndex();
    for (const tok of tokens) {
      const gids = index.termToGroupIds.get(tok);
      if (!gids) continue;
      for (const gid of gids) {
        const terms = index.groupIdToTerms.get(gid) ?? [];
        for (const t of terms) {
          const key = t.toLowerCase().trim();
          if (existingSet.has(key)) continue;
          if (recs.has(t)) continue;
          recs.set(t, { term: t, source: 'synonym', groupId: gid, weight: 10 });
        }
      }
    }
  } catch (err) {
    console.warn('[recommend.recommendKeywords] synonym 실패:', err);
  }

  // 2) 본문 빈도 토큰 — 동의어 매칭 안 된 단어 중 빈도 2+ 인 것
  const freq = new Map<string, number>();
  for (const tok of tokens) {
    freq.set(tok, (freq.get(tok) ?? 0) + 1);
  }
  const topByFreq = Array.from(freq.entries())
    .filter(([t]) => !existingSet.has(t) && !recs.has(t))
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  for (const [t, c] of topByFreq) {
    recs.set(t, {
      term: t,
      source: 'body-extract',
      weight: 5 + Math.min(c, 5),
    });
  }

  // 3) weight 내림차순 + 7개 cap
  return Array.from(recs.values())
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 7);
}

// ─────────────────────────────────────────────────────────────────────────────
// recommendRelatedArticles
// ─────────────────────────────────────────────────────────────────────────────

/** 본문 마크다운에서 /help/ 링크 slug 추출. */
function extractHelpLinkSlugs(body: string): string[] {
  const re = /\[[^\]]+\]\(\/help\/[^)/]+\/[^)/]+\/([a-z0-9-]+)\)/g;
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    if (m[1]) out.add(m[1]);
  }
  return Array.from(out);
}

/**
 * 관련 아티클 추천 — 같은 카테고리(weight 10) + 키워드 교집합(weight 8) + 본문 링크(weight 9).
 *
 * 최대 7개 반환.
 */
export async function recommendRelatedArticles({
  productCode,
  categoryPath,
  keywords,
  body,
  excludeId,
}: RecommendRelatedInput): Promise<RelatedArticleRecommendation[]> {
  if (!db) return [];
  const out = new Map<string, RelatedArticleRecommendation>();

  const baseConds = [
    eq(articles.productCode, productCode),
    eq(articles.status, 'published'),
    eq(articles.isActive, true),
  ];
  if (excludeId) baseConds.push(ne(articles.id, excludeId));

  // 1) 같은 카테고리 path 1단계 일치 → top 5 by viewCount
  if (categoryPath.length > 0) {
    try {
      const rootLabel = categoryPath[0];
      const rows = await db
        .select({
          id: articles.id,
          slug: articles.slug,
          title: articles.title,
          productCode: articles.productCode,
        })
        .from(articles)
        .where(
          and(
            ...baseConds,
            sql`${articles.categoryPath}[1] = ${rootLabel}`,
          ),
        )
        .orderBy(desc(articles.viewCount))
        .limit(5);
      for (const r of rows) {
        out.set(r.id, {
          ...r,
          reason: 'same-category',
          weight: 10,
        });
      }
    } catch (err) {
      console.warn('[recommend.related] same-category 실패:', err);
    }
  }

  // 2) 키워드 교집합 ≥ 1 (단순화 — Phase 후반에 ≥ 2 강화)
  if (keywords.length > 0) {
    try {
      const rows = await db
        .select({
          id: articles.id,
          slug: articles.slug,
          title: articles.title,
          productCode: articles.productCode,
        })
        .from(articles)
        .where(
          and(
            ...baseConds,
            sql`${articles.keywords} && ${keywords}::text[]`,
          ),
        )
        .orderBy(desc(articles.viewCount))
        .limit(5);
      for (const r of rows) {
        if (out.has(r.id)) continue;
        out.set(r.id, { ...r, reason: 'keyword-overlap', weight: 8 });
      }
    } catch (err) {
      console.warn('[recommend.related] keyword-overlap 실패:', err);
    }
  }

  // 3) 본문 안 마크다운 링크에서 자동 추출
  const linkedSlugs = extractHelpLinkSlugs(body);
  if (linkedSlugs.length > 0) {
    try {
      const rows = await db
        .select({
          id: articles.id,
          slug: articles.slug,
          title: articles.title,
          productCode: articles.productCode,
        })
        .from(articles)
        .where(
          and(
            ...baseConds,
            sql`${articles.slug} = ANY(${linkedSlugs}::text[])`,
          ),
        )
        .limit(5);
      for (const r of rows) {
        if (out.has(r.id)) continue;
        out.set(r.id, { ...r, reason: 'body-link', weight: 9 });
      }
    } catch (err) {
      console.warn('[recommend.related] body-link 실패:', err);
    }
  }

  return Array.from(out.values())
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 7);
}
