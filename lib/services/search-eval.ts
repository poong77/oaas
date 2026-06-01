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
import { and, count, desc, eq, inArray } from 'drizzle-orm';

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
  type SearchEvalSource,
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
  const useLlm = judgeMode === 'llm' || (judgeMode === 'hybrid' && !hasLabels);

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
    grades = merged.map((_, i) =>
      scores && i < scores.length ? scores[i]! : 0,
    );
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
// 배치 측정 (진행률 프로그레스바용 — 클라이언트가 10배치로 순차 호출)
// ─────────────────────────────────────────────────────────────────────

/** 활성 골든셋의 id를 등록 시각 순으로 반환 (배치 분할용). */
export async function listEvalQueryIds(): Promise<string[]> {
  if (!db) return [];
  try {
    const rows = await db
      .select({ id: searchEvalQueries.id })
      .from(searchEvalQueries)
      .where(eq(searchEvalQueries.isActive, true))
      .orderBy(searchEvalQueries.createdAt);
    return rows.map((r) => r.id);
  } catch {
    return [];
  }
}

/** 지정 id들만 평가해 details 반환 (저장 안 함). 진행률 배치 단위. */
export async function evaluateBatch(
  queryIds: string[],
  judgeMode: SearchEvalJudge,
): Promise<SearchEvalDetail[]> {
  if (!db || queryIds.length === 0) return [];
  try {
    const queries = await db
      .select()
      .from(searchEvalQueries)
      .where(
        and(
          eq(searchEvalQueries.isActive, true),
          inArray(searchEvalQueries.id, queryIds),
        ),
      );
    const details: SearchEvalDetail[] = [];
    for (const q of queries) {
      details.push(await evaluateQuery(q, judgeMode));
    }
    return details;
  } catch (err) {
    console.error('[search-eval.evaluateBatch] 실패:', err);
    return [];
  }
}

/** 누적된 details로 run을 집계·저장 (배치 측정 마지막 단계). */
export async function saveRun(
  details: SearchEvalDetail[],
  judgeMode: SearchEvalJudge,
  triggeredBy?: string | null,
): Promise<RunEvaluationResult> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  const n = details.length;
  if (n === 0) return { ok: false, message: 'NO_DETAILS' };
  try {
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
        triggeredBy: triggeredBy ?? null,
      })
      .returning({ id: searchEvalRuns.id });
    return {
      ok: true,
      runId: run?.id,
      summary: { queryCount: n, hit1, hit3, mrr, ndcg },
    };
  } catch (err) {
    console.error('[search-eval.saveRun] 실패:', err);
    return { ok: false, message: 'INTERNAL_ERROR' };
  }
}

// ─────────────────────────────────────────────────────────────────────
// 순위 이력 / 버킷 (대시보드)
// ─────────────────────────────────────────────────────────────────────

/** 순위 버킷 — 상위4 이내 / 8 이내 / 9위 이하 / 정답 없음. */
export type RankBuckets = {
  top4: number;
  top8: number;
  rest: number;
  none: number;
  total: number;
};

export function computeBuckets(run: SearchEvalRun | null): RankBuckets {
  const b: RankBuckets = { top4: 0, top8: 0, rest: 0, none: 0, total: 0 };
  if (!run) return b;
  for (const d of run.details) {
    b.total++;
    const r = d.rankOfFirstRelevant;
    if (r === null) b.none++;
    else if (r <= 4) b.top4++;
    else if (r <= 8) b.top8++;
    else b.rest++;
  }
  return b;
}

/**
 * 질의별 순위 이력 — 최근 N개 run에서 각 질의의 rankOfFirstRelevant 추출.
 * @returns { runs: [oldest..newest] 메타, byQuery: queryId → (rank|null)[] (runs 순서) }
 */
export async function getRankHistory(runCount = 4): Promise<{
  runs: { id: string; ranAt: Date }[];
  byQuery: Record<string, (number | null)[]>;
}> {
  const recent = await listRuns(runCount); // newest first
  const ordered = [...recent].reverse(); // oldest → newest
  const byQuery: Record<string, (number | null)[]> = {};
  ordered.forEach((run, idx) => {
    for (const d of run.details) {
      if (!byQuery[d.queryId])
        byQuery[d.queryId] = new Array(ordered.length).fill(null);
      byQuery[d.queryId]![idx] = d.rankOfFirstRelevant;
    }
  });
  return {
    runs: ordered.map((r) => ({ id: r.id, ranAt: r.ranAt })),
    byQuery,
  };
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

// ─────────────────────────────────────────────────────────────────────
// AI 추천 (검수 후 추가) — 검색이력 기반 + 문제해결 아티클 기반
// ─────────────────────────────────────────────────────────────────────

export type SuggestedCandidate = {
  query: string;
  source: 'log' | 'troubleshoot';
  reason: string;
  /** 정답 확정 (troubleshoot=해당 아티클). log는 비우고 options로 어드민이 선택. */
  expectedArticleSlugs: string[];
  expectedFaqIds: string[];
  note: string | null;
  /** log 후보: 현재 검색 상위 결과 — 어드민이 정답 선택. */
  options?: { kind: 'help' | 'faq'; ref: string; title: string }[];
};

/** 기존 골든셋 질의 정규화 집합 (중복 추천 방지). */
async function existingQuerySet(): Promise<Set<string>> {
  if (!db) return new Set();
  const rows = await db
    .select({ query: searchEvalQueries.query })
    .from(searchEvalQueries);
  return new Set(rows.map((r) => r.query.trim().toLowerCase()));
}

/**
 * 검색 이력 기반 추천 — 실사용 빈번 질의 중 골든셋에 없는 것.
 * 정답은 미정(어드민이 현재 top 결과에서 선택) — 순환 자동통과 방지.
 */
export async function suggestFromLogs(
  limit = 15,
): Promise<SuggestedCandidate[]> {
  if (!db) return [];
  try {
    const { topQueries } = await import('./search-logs');
    const top = await topQueries(60, 60);
    const seen = await existingQuerySet();
    const out: SuggestedCandidate[] = [];
    for (const t of top) {
      if (out.length >= limit) break;
      if (seen.has(t.query.trim().toLowerCase())) continue;
      // 현재 검색 상위 3개를 옵션으로 제시 (정답 후보)
      const [arts, fqs] = await Promise.all([
        searchArticles(t.query, { limit: 3 }),
        searchFaqs(t.query, { limit: 3 }),
      ]);
      const options = [
        ...arts.map((a) => ({
          kind: 'help' as const,
          ref: a.slug,
          title: a.title,
        })),
        ...fqs.map((f) => ({
          kind: 'faq' as const,
          ref: f.id,
          title: f.question,
        })),
      ].slice(0, 5);
      out.push({
        query: t.query,
        source: 'log',
        reason: `실사용 검색 ${t.count}회`,
        expectedArticleSlugs: [],
        expectedFaqIds: [],
        note: '검색이력',
        options,
      });
    }
    return out;
  } catch (err) {
    console.error('[search-eval.suggestFromLogs] 실패:', err);
    return [];
  }
}

/**
 * 문제해결(troubleshoot) 아티클 기반 추천 — LLM이 증상형 질의 생성.
 * 해당 아티클이 정답이므로 expected 확정 (비순환).
 */
export async function suggestFromTroubleshoot(options: {
  sampleSize?: number;
  perArticle?: number;
}): Promise<SuggestedCandidate[]> {
  if (!db) return [];
  const sampleSize = Math.min(40, Math.max(1, options.sampleSize ?? 15));
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
      .where(
        and(
          eq(articles.isActive, true),
          eq(articles.status, 'published'),
          eq(articles.contentType, 'troubleshoot'),
        ),
      )
      .orderBy(desc(articles.publishedAt))
      .limit(sampleSize);
    const seen = await existingQuerySet();
    const out: SuggestedCandidate[] = [];
    for (const a of arts) {
      const queries = await generateEvalQueries(
        { title: a.title, summary: a.summary, bodyExcerpt: a.bodyMarkdown },
        perArticle,
      );
      for (const query of queries) {
        const key = query.trim().toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({
          query: query.trim(),
          source: 'troubleshoot',
          reason: `문제해결 문서: ${a.title.slice(0, 40)}`,
          expectedArticleSlugs: [a.slug],
          expectedFaqIds: [],
          note: '문제해결',
        });
      }
    }
    return out;
  } catch (err) {
    console.error('[search-eval.suggestFromTroubleshoot] 실패:', err);
    return [];
  }
}

/** 검수 통과한 후보들을 골든셋에 일괄 추가 (중복 query skip). */
export async function bulkCreateEvalQueries(
  candidates: Array<{
    query: string;
    expectedArticleSlugs?: string[];
    expectedFaqIds?: string[];
    productCode?: string | null;
    note?: string | null;
    source?: SearchEvalSource;
  }>,
): Promise<{ ok: boolean; created: number }> {
  if (!db || candidates.length === 0) return { ok: false, created: 0 };
  try {
    const seen = await existingQuerySet();
    const rows: NewSearchEvalQuery[] = [];
    for (const c of candidates) {
      const q = c.query.trim();
      const key = q.toLowerCase();
      if (q.length < 2 || seen.has(key)) continue;
      seen.add(key);
      rows.push({
        query: q,
        expectedArticleSlugs: c.expectedArticleSlugs ?? [],
        expectedFaqIds: c.expectedFaqIds ?? [],
        productCode: c.productCode ?? null,
        source: c.source ?? 'manual',
        note: c.note ?? null,
      });
    }
    if (rows.length === 0) return { ok: true, created: 0 };
    await db.insert(searchEvalQueries).values(rows);
    return { ok: true, created: rows.length };
  } catch (err) {
    console.error('[search-eval.bulkCreateEvalQueries] 실패:', err);
    return { ok: false, created: 0 };
  }
}
