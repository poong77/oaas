/**
 * 경량 LLM 헬퍼 (Server 전용) — 검색 품질 평가용.
 *
 * 용도:
 *   - generateEvalQueries: 아티클에서 현실적인 사용자 질문 자동 생성 (골든셋 시드)
 *   - judgeRelevance: 검색 결과의 질의 적합도 0~3 채점 (LLM-as-a-judge)
 *
 * graceful degrade: OPENAI_API_KEY 미설정/오류 시 null/빈 배열 반환.
 * OpenAI Chat Completions(JSON 모드) 직접 호출 — 별도 SDK 의존성 없음.
 */

import 'server-only';
import { env, isOpenAIConfigured } from '@/lib/env';

const ENDPOINT = 'https://api.openai.com/v1/chat/completions';
/** 평가/생성용 저비용 모델. */
const MODEL = 'gpt-4o-mini';

async function chatJson<T>(
  system: string,
  user: string,
  opts: { temperature?: number } = {},
): Promise<T | null> {
  if (!isOpenAIConfigured()) return null;
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: opts.temperature ?? 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });
    if (!res.ok) {
      console.warn(`[llm.chatJson] OpenAI ${res.status}:`, (await res.text()).slice(0, 200));
      return null;
    }
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content;
    if (!content) return null;
    return JSON.parse(content) as T;
  } catch (err) {
    console.warn('[llm.chatJson] 오류:', err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * ai-reply-assist — OpenAI 챗 텍스트 호출 (JSON 모드 아님).
 * draft-provider에서 provider='openai' 라우팅 시 사용. 모델은 ai_models.code(예: gpt-4.1-mini).
 * @throws 키 미설정/오류/빈 응답 시 Error (Anthropic의 runClaudeText와 동작 일치 — 호출부 try/catch).
 */
export async function runOpenAIText(opts: {
  system: string;
  user: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
}): Promise<string> {
  if (!isOpenAIConfigured()) {
    throw new Error('OPENAI_API_KEY missing — .env 확인');
  }
  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: opts.model,
        temperature: opts.temperature ?? 0.3,
        max_tokens: opts.maxTokens ?? 1500,
        messages: [
          { role: 'system', content: opts.system },
          { role: 'user', content: opts.user },
        ],
      }),
    });
  } catch (err) {
    throw new Error(
      `OpenAI 호출 실패 (model=${opts.model}): ${err instanceof Error ? err.message : err}`,
    );
  }
  if (!res.ok) {
    const body = (await res.text()).slice(0, 200);
    throw new Error(`OpenAI ${res.status} (model=${opts.model}): ${body}`);
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = json.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error('OpenAI 응답이 비었습니다.');
  return content;
}

/**
 * 아티클 1건에서 현실적 사용자 질문 N개 생성.
 * 호텔리어가 실제로 칠 법한 구어체·증상형 질의 (오타/동의어 포함).
 */
export async function generateEvalQueries(
  article: { title: string; summary?: string | null; bodyExcerpt?: string | null },
  count = 2,
): Promise<string[]> {
  const sys =
    '너는 호텔 솔루션(PMS/키오스크/도어락) 고객지원 검색 품질 평가자다. ' +
    '주어진 도움말 문서를 보고, 이 문서가 정답이 되어야 할 "실제 사용자가 칠 법한 짧은 검색 질의"를 만든다. ' +
    '구어체·증상 위주, 5~20자, 전문용어보다 일상 표현. JSON {"queries": string[]} 형식으로만 답한다.';
  const usr = `문서 제목: ${article.title}\n요약: ${article.summary ?? ''}\n본문 일부: ${(article.bodyExcerpt ?? '').slice(0, 600)}\n\n위 문서가 정답인 검색 질의 ${count}개를 생성.`;
  const out = await chatJson<{ queries?: string[] }>(sys, usr, { temperature: 0.5 });
  return Array.isArray(out?.queries)
    ? out.queries.filter((q) => typeof q === 'string' && q.trim().length >= 2).slice(0, count)
    : [];
}

/**
 * v1.7 — FAQ 검색 키워드 제안 (어드민 에디터 AI 보조).
 * question+answer를 보고 사용자가 칠 법한 한글 검색 키워드를 추출.
 * 영문 약어·외국어는 제외(그건 동의어 마스터 담당, 역할 분리).
 * graceful: 키 미설정/오류 시 빈 배열.
 */
export async function suggestFaqKeywords(
  faq: { question: string; answer?: string | null },
  existing: string[] = [],
): Promise<string[]> {
  const sys =
    '너는 호텔 솔루션(PMS/키오스크/도어락) 고객지원 FAQ 검색 키워드 큐레이터다. ' +
    '주어진 FAQ 질문/답변을 보고, 호텔리어가 이 FAQ를 찾을 때 칠 법한 한글 검색 키워드를 추출한다. ' +
    '규칙: ① 한글 단어/짧은 구 위주(영문 약어·외국어 제외) ② 질문에 그대로 없는 동의어·다른 표현 우선 ' +
    '③ 명사형 2~10자 ④ 3~8개 ⑤ 이미 등록된 키워드는 중복 금지. ' +
    'JSON {"keywords": string[]} 형식으로만 답한다.';
  const usr = `질문: ${faq.question}\n답변: ${(faq.answer ?? '').slice(0, 800)}\n이미 등록된 키워드: ${existing.join(', ') || '(없음)'}\n\n위 FAQ의 검색 키워드를 제안.`;
  const out = await chatJson<{ keywords?: string[] }>(sys, usr, {
    temperature: 0.3,
  });
  return Array.isArray(out?.keywords)
    ? out.keywords
        .filter((k) => typeof k === 'string' && k.trim().length >= 1)
        .map((k) => k.trim().slice(0, 60))
        .slice(0, 8)
    : [];
}

/**
 * 검색 결과 목록의 질의 적합도 채점 (LLM-as-a-judge).
 * @returns 입력 results 순서에 대응하는 0~3 점수 배열 (3=완벽, 0=무관). null이면 실패.
 */
export async function judgeRelevance(
  query: string,
  results: Array<{ title: string; snippet?: string | null }>,
): Promise<number[] | null> {
  if (results.length === 0) return [];
  const sys =
    '너는 검색 적합도 평가자다. 사용자 질의와 검색 결과 문서들을 보고 각 문서가 ' +
    '질의를 해결하는 정도를 0~3으로 채점한다. 3=정확히 답함, 2=관련 높음, 1=약간 관련, 0=무관. ' +
    'JSON {"scores": number[]} 형식으로만, 입력 순서대로 답한다.';
  const list = results
    .map((r, i) => `${i + 1}. ${r.title}${r.snippet ? ` — ${r.snippet.slice(0, 120)}` : ''}`)
    .join('\n');
  const usr = `질의: "${query}"\n\n결과:\n${list}\n\n각 결과의 적합도 점수(0~3)를 ${results.length}개 배열로.`;
  const out = await chatJson<{ scores?: number[] }>(sys, usr, { temperature: 0 });
  if (!Array.isArray(out?.scores)) return null;
  // 길이/범위 보정
  return results.map((_, i) => {
    const s = Number(out.scores![i]);
    return Number.isFinite(s) ? Math.max(0, Math.min(3, Math.round(s))) : 0;
  });
}
