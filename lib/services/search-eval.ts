/**
 * 검색 품질 평가 엔진 — Layer A (Server 전용).
 *
 * 표준 IR 지표를 실제 검색 함수(searchArticles + searchFaqs)로 산출:
 *   - Hit@1 / Hit@3 (Success@k): 정답이 top-1 / top-3 에 들어간 질의 비율
 *   - MRR (Mean Reciprocal Rank): 정답 첫 등장 등수의 역수 평균 (1위=1.0)
 *   - nDCG@5: 위치 가중 + 등급 관련도 (구글/아마존 검색팀 표준)
 *
 * 정답 판정(judge):
 *   - label: 골든셋 정답 ref(slug/faqId)가 결과에 있으면 적합 (이진)
 *   - llm: LLM이 top-5 적합도 0~3 채점 (graded)
 *   - hybrid: 라벨 있으면 라벨, 없으면 LLM
 *
 * @see db/schema/search-eval.ts
 */

import 'server-only';
import { and, count, desc, eq } from 'drizzle-orm';

import { db } from '@/db';
import {
  articles,
  faqs,
  searchEvalQueries,
  searchEvalRuns,
  type NewSearchEvalQuery,
  type SearchEvalDetail,
  type SearchEvalJudge,
  type SearchEvalQuery,
  type SearchEvalRun,
} from '@/db/schema';
import { searchArticles } from './articles';
import { searchFaqs } from './faqs';
import { generateEvalQueries, judgeRelevance } from './llm';

/** 병합 결과 후보. */
type Candidate = {
  kind: 'help' | 'faq';
  ref: string;
  title: string;
  score: number;
  snippet: string | null;
};

const NDCG_K = 5;
const TOP_STORE = 8; // 질의별 상세에 저장할 상위 결과 수

function dcgAt(grades: number[], k: number): number {
  let dcg = 0;
  for (let i = 0; i < Math.min(k, grades.length); i++) {
    dcg += grades[i]! / Math.log2(i + 2); // position i+1 → log2(i+2)
  }
  return dcg;
}

function ndcgAt(grades: number[], k: number): number {
  const dcg = dcgAt(grades, k);
  const ideal = [...grades].sort((a, b) => b - a);
  const idcg = dcgAt(ideal, k);
  return idcg > 0 ? dcg / idcg : 0;
}

/** 단일 질의를 실제 검색에 돌려 병합 랭킹 후보를 만든다. */
async function searchUnified(q: SearchEvalQuery): Promise<Candidate[]> {
  const [arts, fqs] = await Promise.all([
    searchArticles(q.query, {
      productCode: q.productCode ?? undefined,
      limit: 20,
    }),
    searchFaqs(q.query, {
      productCode: q.productCode ?? undefined,
      limit: 20,
    }),
  ]);
  const merged: Candidate[] = [
    ...arts.map((a) => ({
      kind: 'help' as const,
      ref: a.slug,
      title: a.title,
      score: a.score,
      snippet: a.summary ?? a.summary30s ?? null,
    })),
    ...fqs.map((f) => ({
      kind: 'faq' as const,
      ref: f.id,
      title: f.question,
      score: f.score,
      snippet: f.answerMarkdown,
    })),
  ];
  return merged.sort((a, b) => b.score - a.score);
}

async function evaluateQuery(
  q: SearchEvalQuery,
  judgeMode: SearchEvalJudge,
): Promise<SearchEvalDetail> {
  const merged = await searchUnified(q);

  const hasLabels =
    q.expectedArticleSlugs.length > 0 || q.expectedFaqIds.length > 0;
  const useLlm =
    judgeMode === 'llm' || (judgeMode === 'hybrid' && !hasLabels);

  // 등급 grades[i] 계산 (nDCG/적합 판정용).
  let grades: number[];
  let judgeScores: (number | undefined)[] = [];
  if (useLlm) {
    // 비용 절감: 상위 NDCG_K개만 LLM 채점, 이후는 0.
    const head = merged.slice(0, NDCG_K);
    const scores = await judgeRelevance(
      q.query,
      head.map((c) => ({ title: c.title, snippet: c.snippet })),
    );
    judgeScores = merged.map((_, i) => (scores ? scores[i] : undefined));
    grades = merged.map((_, i) => (scores && i < scores.length ? scores[i]! : 0));
  } else {
    // 라벨 기준 이진 등급 (전체 리스트 스캔 — API 비용 없음).
    const artSet = new Set(q.expectedArticleSlugs);
    const faqSet = new Set(q.expectedFaqIds);
    grades = merged.map((c) =>
      (c.kind === 'help' && artSet.has(c.ref)) ||
      (c.kind === 'faq' && faqSet.has(c.ref))
        ? 1
        : 0,
    );
  }

  // 적합 임계값: LLM은 2점 이상, 라벨은 1.
  const relThreshold = useLlm ? 2 : 1;
  const relevant = grades.map((g) => g >= relThreshold);

  let rankOfFirstRelevant: number | null = null;
  for (let i = 0; i < relevant.length; i++) {
    if (relevant[i]) {
      rankOfFirstRelevant = i + 1;
      break;
    }
  }
  const reciprocalRank = rankOfFirstRelevant ? 1 / rankOfFirstRelevant : 0;

  return {
    queryId: q.id,
    query: q.query,
    note: q.note,
    rankOfFirstRelevant,
    reciprocalRank,
    ndcg: ndcgAt(grades, NDCG_K),
    hitTop1: rankOfFirstRelevant === 1,
    hitTop3: rankOfFirstRelevant !== null && rankOfFirstRelevant <= 3,
    top: merged.slice(0, TOP_STORE).map((c, i) => ({
      kind: c.kind,
      ref: c.ref,
      title: c.title,
      score: Number(c.score.toFixed(3)),
      relevant: relevant[i] ?? false,
      judgeScore: judgeScores[i],
    })),
  };
}

// ─────────────────────────────────────────────────────────────────────
// 평가 실행
// ─────────────────────────────────────────────────────────────────────

export type RunEvaluationResult = {
  ok: boolean;
  runId?: string;
  message?: string;
  summary?: {
    queryCount: number;
    hit1: number;
    hit3: number;
    mrr: number;
    ndcg: number;
  };
};

/** 활성 골든셋 전체를 평가하고 결과를 search_eval_runs에 저장. */
export async function runEvaluation(options: {
  judgeMode?: SearchEvalJudge;
  triggeredBy?: string | null;
}): Promise<RunEvaluationResult> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  const judgeMode = options.judgeMode ?? 'label';
  try {
    const queries = await db
      .select()
      .from(searchEvalQueries)
      .where(eq(searchEvalQueries.isActive, true));
    if (queries.length === 0) {
      return { ok: false, message: 'NO_GOLDEN_QUERIES' };
    }

    const details: SearchEvalDetail[] = [];
    // 순차 실행 (LLM 채점 rate-limit + 검색 부하 완화).
    for (const q of queries) {
      details.push(await evaluateQuery(q, judgeMode));
    }

    const n = details.length;
    const hit1 = details.filter((d) => d.hitTop1).length / n;
    const hit3 = details.filter((d) => d.hitTop3).length / n;
    const mrr = details.reduce((s, d) => s + d.reciprocalRank, 0) / n;
    const ndcg = details.reduce((s, d) => s + d.ndcg, 0) / n;

    const [run] = await db
      .insert(searchEvalRuns)
      .values({
        queryCount: n,
        hit1,
        hit3,
        mrr,
        ndcg,
        judgeMode,
        params: { vecWeight: 4, ndcgK: NDCG_K },
        details,
        triggeredBy: options.triggeredBy ?? null,
      })
      .returning({ id: searchEvalRuns.id });

    return {
      ok: true,
      runId: run?.id,
      summary: { queryCount: n, hit1, hit3, mrr, ndcg },
    };
  } catch (err) {
    console.error('[search-eval.runEvaluation] 실패:', err);
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'INTERNAL_ERROR',
    };
  }
}

// ─────────────────────────────────────────────────────────────────────
// 골든셋 관리 (조회 / 시드 / 생성 / CRUD)
// ─────────────────────────────────────────────────────────────────────

export async function listEvalQueries(): Promise<SearchEvalQuery[]> {
  if (!db) return [];
  try {
    return await db
      .select()
      .from(searchEvalQueries)
      .where(eq(searchEvalQueries.isActive, true))
      .orderBy(desc(searchEvalQueries.createdAt));
  } catch (err) {
    console.error('[search-eval.listEvalQueries] 실패:', err);
    return [];
  }
}

export async function countEvalQueries(): Promise<number> {
  if (!db) return 0;
  try {
    const rows = await db
      .select({ c: count() })
      .from(searchEvalQueries)
      .where(eq(searchEvalQueries.isActive, true));
    return Number(rows[0]?.c ?? 0);
  } catch {
    return 0;
  }
}

export async function listRuns(limit = 20): Promise<SearchEvalRun[]> {
  if (!db) return [];
  try {
    return await db
      .select()
      .from(searchEvalRuns)
      .orderBy(desc(searchEvalRuns.ranAt))
      .limit(limit);
  } catch (err) {
    console.error('[search-eval.listRuns] 실패:', err);
    return [];
  }
}

export async function getLatestRun(): Promise<SearchEvalRun | null> {
  const runs = await listRuns(1);
  return runs[0] ?? null;
}

export async function getRunById(id: string): Promise<SearchEvalRun | null> {
  if (!db) return null;
  try {
    const rows = await db
      .select()
      .from(searchEvalRuns)
      .where(eq(searchEvalRuns.id, id))
      .limit(1);
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

/** 활성 FAQ에서 골든셋 자동 시드 (question→해당 FAQ). 멱등(기존 질의 텍스트 skip). */
export async function seedFromFaqs(): Promise<{
  ok: boolean;
  created: number;
  message?: string;
}> {
  if (!db) return { ok: false, created: 0, message: 'DB_NOT_READY' };
  try {
    const rows = await db
      .select({
        id: faqs.id,
        question: faqs.question,
        issueType: faqs.issueType,
        productCode: faqs.productCode,
      })
      .from(faqs)
      .where(eq(faqs.isActive, true));

    const existing = await db
      .select({ query: searchEvalQueries.query })
      .from(searchEvalQueries);
    const seen = new Set(existing.map((e) => e.query.trim().toLowerCase()));

    const toInsert: NewSearchEvalQuery[] = [];
    for (const f of rows) {
      const key = f.question.trim().toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      toInsert.push({
        query: f.question.trim(),
        expectedFaqIds: [f.id],
        expectedArticleSlugs: [],
        productCode: f.productCode ?? null,
        source: 'faq',
        note: f.issueType ?? null,
      });
    }
    if (toInsert.length > 0) {
      await db.insert(searchEvalQueries).values(toInsert);
    }
    return { ok: true, created: toInsert.length };
  } catch (err) {
    console.error('[search-eval.seedFromFaqs] 실패:', err);
    return { ok: false, created: 0, message: 'INTERNAL_ERROR' };
  }
}

/**
 * 발행 아티클에서 LLM으로 질의 생성 (골든셋 시드).
 * @param sampleSize 대상 아티클 수 (최신 발행 기준). 비용 가드.
 * @param perArticle 아티클당 생성 질의 수.
 */
export async function generateQueriesFromArticles(options: {
  sampleSize?: number;
  perArticle?: number;
}): Promise<{ ok: boolean; created: number; message?: string }> {
  if (!db) return { ok: false, created: 0, message: 'DB_NOT_READY' };
  const sampleSize = Math.min(100, Math.max(1, options.sampleSize ?? 20));
  const perArticle = Math.min(3, Math.max(1, options.perArticle ?? 2));
  try {
    const arts = await db
      .select({
        slug: articles.slug,
        title: articles.title,
        summary: articles.summary,
        bodyMarkdown: articles.bodyMarkdown,
      })
      .from(articles)
      .where(and(eq(articles.isActive, true), eq(articles.status, 'published')))
      .orderBy(desc(articles.publishedAt))
      .limit(sampleSize);

    const existing = await db
      .select({ query: searchEvalQueries.query })
      .from(searchEvalQueries);
    const seen = new Set(existing.map((e) => e.query.trim().toLowerCase()));

    const toInsert: NewSearchEvalQuery[] = [];
    for (const a of arts) {
      const queries = await generateEvalQueries(
        { title: a.title, summary: a.summary, bodyExcerpt: a.bodyMarkdown },
        perArticle,
      );
      for (const query of queries) {
        const key = query.trim().toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        toInsert.push({
          query: query.trim(),
          expectedArticleSlugs: [a.slug],
          expectedFaqIds: [],
          source: 'llm',
          note: a.title.slice(0, 60),
        });
      }
    }
    if (toInsert.length > 0) {
      await db.insert(searchEvalQueries).values(toInsert);
    }
    return { ok: true, created: toInsert.length };
  } catch (err) {
    console.error('[search-eval.generateQueriesFromArticles] 실패:', err);
    return { ok: false, created: 0, message: 'INTERNAL_ERROR' };
  }
}

export async function createEvalQuery(input: {
  query: string;
  expectedArticleSlugs?: string[];
  expectedFaqIds?: string[];
  productCode?: string | null;
  note?: string | null;
}): Promise<{ ok: boolean; id?: string; message?: string }> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  const query = input.query.trim();
  if (query.length < 2) return { ok: false, message: 'QUERY_TOO_SHORT' };
  try {
    const [row] = await db
      .insert(searchEvalQueries)
      .values({
        query,
        expectedArticleSlugs: input.expectedArticleSlugs ?? [],
        expectedFaqIds: input.expectedFaqIds ?? [],
        productCode: input.productCode ?? null,
        source: 'manual',
        note: input.note ?? null,
      })
      .returning({ id: searchEvalQueries.id });
    return { ok: true, id: row?.id };
  } catch (err) {
    console.error('[search-eval.createEvalQuery] 실패:', err);
    return { ok: false, message: 'INTERNAL_ERROR' };
  }
}

export async function updateEvalQuery(
  id: string,
  input: {
    query?: string;
    expectedArticleSlugs?: string[];
    expectedFaqIds?: string[];
    productCode?: string | null;
    note?: string | null;
  },
): Promise<{ ok: boolean; message?: string }> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  try {
    const patch: Partial<NewSearchEvalQuery> = {};
    if (input.query !== undefined) patch.query = input.query.trim();
    if (input.expectedArticleSlugs !== undefined)
      patch.expectedArticleSlugs = input.expectedArticleSlugs;
    if (input.expectedFaqIds !== undefined)
      patch.expectedFaqIds = input.expectedFaqIds;
    if (input.productCode !== undefined)
      patch.productCode = input.productCode ?? null;
    if (input.note !== undefined) patch.note = input.note ?? null;
    await db
      .update(searchEvalQueries)
      .set(patch)
      .where(eq(searchEvalQueries.id, id));
    return { ok: true };
  } catch (err) {
    console.error('[search-eval.updateEvalQuery] 실패:', err);
    return { ok: false, message: 'INTERNAL_ERROR' };
  }
}

/** 소프트 삭제 (is_active=false). */
export async function archiveEvalQuery(
  id: string,
): Promise<{ ok: boolean; message?: string }> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  try {
    await db
      .update(searchEvalQueries)
      .set({ isActive: false })
      .where(eq(searchEvalQueries.id, id));
    return { ok: true };
  } catch (err) {
    console.error('[search-eval.archiveEvalQuery] 실패:', err);
    return { ok: false, message: 'INTERNAL_ERROR' };
  }
}

/** 골든셋 일괄 비우기 (재시드 전 정리용). 소프트 삭제. */
export async function archiveAllEvalQueries(
  source?: SearchEvalQuery['source'],
): Promise<{ ok: boolean; archived: number }> {
  if (!db) return { ok: false, archived: 0 };
  try {
    const conds = [eq(searchEvalQueries.isActive, true)];
    if (source) conds.push(eq(searchEvalQueries.source, source));
    const rows = await db
      .update(searchEvalQueries)
      .set({ isActive: false })
      .where(and(...conds))
      .returning({ id: searchEvalQueries.id });
    return { ok: true, archived: rows.length };
  } catch (err) {
    console.error('[search-eval.archiveAllEvalQueries] 실패:', err);
    return { ok: false, archived: 0 };
  }
}
