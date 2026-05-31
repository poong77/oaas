/**
 * 아티클 기반 동의어 갭 탐지 (v1.3 Phase A).
 *
 * 발행 아티클의 `keywords[]`(사람이 큐레이션한 한글 키워드)를 전수 집계하고,
 * 동의어 사전(`loadSynonymIndex`)과 대조하여 **미등록 키워드**를 추출한다.
 *
 * 원칙:
 *   - 읽기 전용 분석. 자동 INSERT 없음 (검색 품질 오염 방지).
 *   - 후보 제시 → 어드민 검수 → 수동 반영. `/admin/master/synonyms` 카드에서 노출.
 *
 * 매칭 기준: `collapseSpacing`(NFC+lower+trim+공백·하이픈 제거) 기준으로 동의어
 *           인덱스의 어떤 term과도 일치하지 않는 키워드를 "미등록(gap)"으로 본다.
 *           → '실시간 객실'과 '실시간객실'은 한 후보로 병합되고, 사전에 둘 중
 *             하나만 있어도 등록된 것으로 간주한다.
 */

import 'server-only';
import { and, eq } from 'drizzle-orm';

import { db } from '@/db';
import { articles } from '@/db/schema';
import { loadSynonymIndex } from './master-synonyms';
import { collapseSpacing } from '@/lib/text/normalize';

export type KeywordGap = {
  /** 키워드 원본 (대표 표기 — 가장 빈번한 원형 보존) */
  term: string;
  /** 이 키워드를 가진 발행 아티클 수 */
  articleCount: number;
};

export type KeywordGapResult = {
  /** 미등록 키워드 (빈도순 desc) */
  gaps: KeywordGap[];
  /** 발행 아티클에서 수집한 고유 키워드 총수 */
  totalDistinctKeywords: number;
  /** 그중 동의어 사전에 이미 등록된 키워드 수 */
  coveredKeywords: number;
};

export type AnalyzeKeywordGapsOptions = {
  /** 반환 상한 (기본 30). */
  limit?: number;
  /** 최소 아티클 수 (기본 1 — 1건 이상 등장 키워드). */
  minArticleCount?: number;
};

/**
 * 발행 아티클 keywords[]를 집계해 동의어 사전 미등록 키워드를 반환.
 *
 * @example
 *   const { gaps } = await analyzeKeywordGaps({ limit: 20 });
 *   // gaps: [{ term: '미수금', articleCount: 4 }, ...]
 */
export async function analyzeKeywordGaps(
  options: AnalyzeKeywordGapsOptions = {},
): Promise<KeywordGapResult> {
  const limit = Math.max(1, options.limit ?? 30);
  const minArticleCount = Math.max(1, options.minArticleCount ?? 1);

  if (!db) {
    return { gaps: [], totalDistinctKeywords: 0, coveredKeywords: 0 };
  }

  try {
    // 1) 발행·활성 아티클의 keywords[]만 로딩
    const rows = await db
      .select({ keywords: articles.keywords })
      .from(articles)
      .where(
        and(eq(articles.status, 'published'), eq(articles.isActive, true)),
      );

    // 2) normalize(키워드) → { 원본 표기, 등장 아티클 수 } 집계
    //    같은 키워드를 여러 아티클이 가질 수 있으므로 아티클 단위로 중복 제거 후 카운트.
    const counts = new Map<
      string,
      { display: string; articleCount: number }
    >();
    for (const row of rows) {
      if (row.keywords.length === 0) continue;
      const seenInArticle = new Set<string>();
      for (const raw of row.keywords) {
        // collapse 키로 집계 → '실시간 객실'과 '실시간객실'을 한 후보로 병합
        const key = collapseSpacing(raw);
        if (!key || key.length < 2) continue; // 1자 키워드 제외 (검색 토큰 정책 Q-3 정렬)
        if (seenInArticle.has(key)) continue;
        seenInArticle.add(key);
        const prev = counts.get(key);
        if (prev) {
          prev.articleCount += 1;
        } else {
          counts.set(key, { display: raw.trim() || raw, articleCount: 1 });
        }
      }
    }

    const totalDistinctKeywords = counts.size;

    // 3) 동의어 사전과 대조 — termToGroupIds(normalize된 key)에 없으면 미등록
    const index = await loadSynonymIndex();
    let coveredKeywords = 0;
    const gaps: KeywordGap[] = [];
    for (const [key, { display, articleCount }] of counts) {
      if (index.termToGroupIds.has(key)) {
        coveredKeywords += 1;
        continue;
      }
      if (articleCount < minArticleCount) continue;
      gaps.push({ term: display, articleCount });
    }

    // 4) 빈도 desc → 동률 시 가나다순
    gaps.sort(
      (a, b) =>
        b.articleCount - a.articleCount ||
        a.term.localeCompare(b.term, 'ko'),
    );

    return {
      gaps: gaps.slice(0, limit),
      totalDistinctKeywords,
      coveredKeywords,
    };
  } catch (err) {
    console.error('[keyword-gap.analyzeKeywordGaps] 실패:', err);
    return { gaps: [], totalDistinctKeywords: 0, coveredKeywords: 0 };
  }
}
