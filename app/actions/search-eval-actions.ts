'use server';

/**
 * 검색 품질 평가 서버 액션 — Layer A.
 * 권한: manager + admin (콘텐츠 운영 범위).
 */

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/permissions';
import { logActivity } from '@/lib/audit';
import {
  archiveAllEvalQueries,
  archiveEvalQuery,
  bulkCreateEvalQueries,
  createEvalQuery,
  evaluateBatch,
  generateQueriesFromArticles,
  runEvaluation,
  saveRun,
  seedFromFaqs,
  suggestFromLogs,
  suggestFromTroubleshoot,
  updateEvalQuery,
  type SuggestedCandidate,
} from '@/lib/services/search-eval';
import type {
  SearchEvalDetail,
  SearchEvalJudge,
  SearchEvalSource,
} from '@/db/schema';

const PATH = '/admin/master/search-quality';

export async function runEvaluationAction(
  judgeMode: SearchEvalJudge = 'label',
): Promise<{ ok: boolean; runId?: string; message?: string }> {
  const user = await requireRole(['manager', 'admin']);
  const res = await runEvaluation({ judgeMode, triggeredBy: user.id });
  if (res.ok) {
    logActivity({
      userId: user.id,
      action: 'search_eval.run',
      targetType: 'search_eval_run',
      targetId: res.runId,
      payload: { judgeMode, summary: res.summary },
    });
    revalidatePath(PATH);
  }
  return { ok: res.ok, runId: res.runId, message: res.message };
}

/** 배치 측정 — 진행률 프로그레스바용. 클라이언트가 10배치로 순차 호출. */
export async function evaluateBatchAction(
  queryIds: string[],
  judgeMode: SearchEvalJudge = 'label',
): Promise<{ ok: boolean; details: SearchEvalDetail[] }> {
  await requireRole(['manager', 'admin']);
  const details = await evaluateBatch(queryIds, judgeMode);
  return { ok: true, details };
}

/** 배치 측정 누적 결과 저장 (마지막 단계). */
export async function saveRunAction(
  details: SearchEvalDetail[],
  judgeMode: SearchEvalJudge = 'label',
): Promise<{ ok: boolean; runId?: string; message?: string }> {
  const user = await requireRole(['manager', 'admin']);
  const res = await saveRun(details, judgeMode, user.id);
  if (res.ok) {
    logActivity({
      userId: user.id,
      action: 'search_eval.run',
      targetType: 'search_eval_run',
      targetId: res.runId,
      payload: { judgeMode, summary: res.summary, batched: true },
    });
    revalidatePath(PATH);
  }
  return { ok: res.ok, runId: res.runId, message: res.message };
}

export async function suggestFromLogsAction(): Promise<{
  ok: boolean;
  candidates: SuggestedCandidate[];
}> {
  await requireRole(['manager', 'admin']);
  const candidates = await suggestFromLogs(15);
  return { ok: true, candidates };
}

export async function suggestFromTroubleshootAction(): Promise<{
  ok: boolean;
  candidates: SuggestedCandidate[];
}> {
  await requireRole(['manager', 'admin']);
  const candidates = await suggestFromTroubleshoot({
    sampleSize: 15,
    perArticle: 2,
  });
  return { ok: true, candidates };
}

export async function bulkCreateEvalQueriesAction(
  candidates: Array<{
    query: string;
    expectedArticleSlugs?: string[];
    expectedFaqIds?: string[];
    note?: string | null;
    source?: SearchEvalSource;
  }>,
): Promise<{ ok: boolean; created: number }> {
  const user = await requireRole(['manager', 'admin']);
  const res = await bulkCreateEvalQueries(candidates);
  if (res.ok) {
    logActivity({
      userId: user.id,
      action: 'search_eval.bulk_create',
      payload: { created: res.created },
    });
    revalidatePath(PATH);
  }
  return res;
}

export async function seedFromFaqsAction(): Promise<{
  ok: boolean;
  created: number;
  message?: string;
}> {
  const user = await requireRole(['manager', 'admin']);
  const res = await seedFromFaqs();
  if (res.ok) {
    logActivity({
      userId: user.id,
      action: 'search_eval.seed_faqs',
      payload: { created: res.created },
    });
    revalidatePath(PATH);
  }
  return res;
}

export async function generateQueriesAction(
  sampleSize = 20,
  perArticle = 2,
): Promise<{ ok: boolean; created: number; message?: string }> {
  const user = await requireRole(['manager', 'admin']);
  const res = await generateQueriesFromArticles({ sampleSize, perArticle });
  if (res.ok) {
    logActivity({
      userId: user.id,
      action: 'search_eval.generate_queries',
      payload: { created: res.created, sampleSize, perArticle },
    });
    revalidatePath(PATH);
  }
  return res;
}

export async function createEvalQueryAction(input: {
  query: string;
  expectedArticleSlugs?: string[];
  expectedFaqIds?: string[];
  productCode?: string | null;
  note?: string | null;
}): Promise<{ ok: boolean; id?: string; message?: string }> {
  const user = await requireRole(['manager', 'admin']);
  const res = await createEvalQuery(input);
  if (res.ok) {
    logActivity({
      userId: user.id,
      action: 'search_eval.query.create',
      targetType: 'search_eval_query',
      targetId: res.id,
      payload: { query: input.query },
    });
    revalidatePath(PATH);
  }
  return res;
}

export async function updateEvalQueryAction(
  id: string,
  input: {
    query?: string;
    expectedArticleSlugs?: string[];
    expectedFaqIds?: string[];
    productCode?: string | null;
    note?: string | null;
  },
): Promise<{ ok: boolean; message?: string }> {
  const user = await requireRole(['manager', 'admin']);
  const res = await updateEvalQuery(id, input);
  if (res.ok) {
    logActivity({
      userId: user.id,
      action: 'search_eval.query.update',
      targetType: 'search_eval_query',
      targetId: id,
    });
    revalidatePath(PATH);
  }
  return res;
}

export async function archiveEvalQueryAction(
  id: string,
): Promise<{ ok: boolean; message?: string }> {
  const user = await requireRole(['manager', 'admin']);
  const res = await archiveEvalQuery(id);
  if (res.ok) {
    logActivity({
      userId: user.id,
      action: 'search_eval.query.archive',
      targetType: 'search_eval_query',
      targetId: id,
    });
    revalidatePath(PATH);
  }
  return res;
}

export async function archiveAllEvalQueriesAction(
  source?: SearchEvalSource,
): Promise<{ ok: boolean; archived: number }> {
  const user = await requireRole(['manager', 'admin']);
  const res = await archiveAllEvalQueries(source);
  if (res.ok) {
    logActivity({
      userId: user.id,
      action: 'search_eval.query.archive_all',
      payload: { source: source ?? 'all', archived: res.archived },
    });
    revalidatePath(PATH);
  }
  return res;
}
