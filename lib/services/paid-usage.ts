/**
 * 유료 사용현황 집계 (server 전용) — '유료 사용현황' 어드민 대시보드 단일 소스.
 *
 * 데이터 소스:
 *   - AI : ai_usage_logs (lib/ai/cost-tracker가 적재. 배포 시점 이후 데이터만 존재)
 *   - 문자: notification_logs (channel='sms', status='sent'). 과거 데이터까지 소급 집계.
 *           문자 종류는 payload.msgType(수동 발송) 우선, 없으면 본문으로 classifySms 폴백.
 *
 * 모든 버킷은 KST(Asia/Seoul) 기준. 일/주/월 모두 "일 단위 집계 → 기간 롤업"으로
 * 동일한 경계를 보장한다.
 *
 * @see lib/ai/pricing.ts · db/schema/ai-usage-logs.ts · db/schema/notification-logs.ts
 */

import 'server-only';
import { and, eq, gte, sql } from 'drizzle-orm';

import { db } from '@/db';
import { aiUsageLogs } from '@/db/schema/ai-usage-logs';
import { notificationLogs } from '@/db/schema/notification-logs';
import { kstYmd } from '@/lib/date/kst';
import { classifySms, type SmsKind } from '@/lib/messaging/format';
import { SMS_PRICING_KRW } from '@/lib/ai/pricing';

export type UsagePeriod = 'daily' | 'weekly' | 'monthly';

/** 용도 묶음 — 답변·콘텐츠 생성 / 추천·보조 / 검색 인프라 / 기타. */
export type BucketCategory = 'gen' | 'rec' | 'infra' | 'etc';

export type UsageBucketBreakdown = {
  /** 한글 표기 라벨 (ai-rewrite-* 등은 하나로 병합) */
  label: string;
  category: BucketCategory;
  /** 병합된 원본 bucket 키 목록 (툴팁/디버깅용) */
  buckets: string[];
  calls: number;
  costUsd: number;
};

/**
 * cost-tracker가 적재하는 raw bucket → 한글 라벨·묶음 매핑.
 * 신규 호출 분류 추가 시 여기에 등록(미등록은 '기타'로 표시).
 * @see lib/services/llm.ts · lib/ai/draft-provider.ts · 각 *-actions.ts
 */
function classifyBucket(bucket: string): {
  label: string;
  category: BucketCategory;
} {
  if (bucket.startsWith('ai-rewrite-'))
    return { label: '아티클 리라이트', category: 'gen' };
  switch (bucket) {
    case 'ticket-draft':
      return { label: '티켓 답변 초안', category: 'gen' };
    case 'ai-assist':
      return { label: '아티클 작성 보조', category: 'gen' };
    case 'ai-notice-draft':
      return { label: '공지 초안 작성', category: 'gen' };
    case 'messaging-email-write':
      return { label: '메일 본문 작성', category: 'gen' };
    case 'ai-faq-keywords':
      return { label: 'FAQ 키워드 추천', category: 'rec' };
    case 'ai-synonym-suggest':
      return { label: '동의어 추천', category: 'rec' };
    case 'search-eval':
      return { label: '검색 품질 평가', category: 'infra' };
    case 'embeddings':
      return { label: '검색 임베딩', category: 'infra' };
    default:
      return { label: bucket || '기타', category: 'etc' };
  }
}

export type UsageBucket = {
  /** 정렬·매칭 키 (일: YYYY-MM-DD / 주: 월요일 YYYY-MM-DD / 월: YYYY-MM) */
  key: string;
  /** 화면 표기 라벨 */
  label: string;
  aiCalls: number;
  aiCostUsd: number;
  smsCount: number;
  smsCostKrw: number;
};

export type PaidUsageReport = {
  period: UsagePeriod;
  buckets: UsageBucket[];
  totals: {
    aiCalls: number;
    aiCostUsd: number;
    aiInputTokens: number;
    aiOutputTokens: number;
    smsCount: number;
    smsCostKrw: number;
    smsByKind: Record<SmsKind, number>;
  };
  aiByModel: {
    provider: string;
    model: string;
    calls: number;
    costUsd: number;
  }[];
  /** 용도(bucket)별 내역 — 비용 높은 순 */
  aiByBucket: UsageBucketBreakdown[];
  /** window 내 AI 적재 데이터 존재 여부 (false면 '적재 대기' 안내) */
  hasAiData: boolean;
  generatedAtIso: string;
};

// ── KST/YMD 산술 (타임존 라이브러리 없이 순수 문자열 연산) ───────────────

/** ymd('YYYY-MM-DD') + delta일 → 'YYYY-MM-DD'. (정오 UTC 기준 — DST·TZ 무관) */
function addDaysYmd(ymd: string, delta: number): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/** ymd + delta월 → 'YYYY-MM'. */
function addMonthsYmd(ymd: string, delta: number): string {
  const [y, m] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + delta, 1, 12)).toISOString().slice(0, 7);
}

/** 해당 날짜가 속한 주의 월요일 ymd. */
function mondayOf(ymd: string): string {
  const wd = new Date(`${ymd}T12:00:00Z`).getUTCDay(); // 0=일
  return addDaysYmd(ymd, -((wd + 6) % 7));
}

/** KST 자정의 UTC 순간. */
function kstStartOfDay(ymd: string): Date {
  return new Date(`${ymd}T00:00:00+09:00`);
}

function bucketKeyFor(ymd: string, period: UsagePeriod): string {
  if (period === 'weekly') return mondayOf(ymd);
  if (period === 'monthly') return ymd.slice(0, 7);
  return ymd;
}

function bucketLabel(key: string, period: UsagePeriod): string {
  if (period === 'monthly') {
    const [y, m] = key.split('-');
    return `${y}.${m}`;
  }
  const [, m, d] = key.split('-');
  return period === 'weekly' ? `${Number(m)}/${Number(d)}~` : `${Number(m)}/${Number(d)}`;
}

/** 기간별 기대 버킷 키 목록(과거→현재). 빈 구간도 0으로 노출하기 위함. */
function expectedKeys(period: UsagePeriod, todayYmd: string): string[] {
  const keys: string[] = [];
  if (period === 'daily') {
    for (let i = 29; i >= 0; i--) keys.push(addDaysYmd(todayYmd, -i));
  } else if (period === 'weekly') {
    const thisMon = mondayOf(todayYmd);
    for (let i = 11; i >= 0; i--) keys.push(addDaysYmd(thisMon, -7 * i));
  } else {
    for (let i = 11; i >= 0; i--) keys.push(addMonthsYmd(todayYmd, -i));
  }
  return keys;
}

function emptyReport(period: UsagePeriod): PaidUsageReport {
  return {
    period,
    buckets: [],
    totals: {
      aiCalls: 0,
      aiCostUsd: 0,
      aiInputTokens: 0,
      aiOutputTokens: 0,
      smsCount: 0,
      smsCostKrw: 0,
      smsByKind: { sms: 0, lms: 0, mms: 0 },
    },
    aiByModel: [],
    aiByBucket: [],
    hasAiData: false,
    generatedAtIso: new Date().toISOString(),
  };
}

/** 메인 집계 진입점. */
export async function getPaidUsageReport(
  period: UsagePeriod,
): Promise<PaidUsageReport> {
  if (!db) return emptyReport(period);
  const todayYmd = kstYmd(new Date());
  const keys = expectedKeys(period, todayYmd);
  const start = kstStartOfDay(
    period === 'monthly' ? `${keys[0]}-01` : keys[0],
  );

  // ── AI: KST 일 단위 SQL 집계 ──────────────────────────────────────
  const aiDailyRows = await db
    .select({
      ymd: sql<string>`to_char(${aiUsageLogs.createdAt} at time zone 'Asia/Seoul', 'YYYY-MM-DD')`,
      calls: sql<number>`count(*)::int`,
      cost: sql<number>`coalesce(sum(${aiUsageLogs.costUsd}), 0)::float8`,
      input: sql<number>`coalesce(sum(${aiUsageLogs.inputTokens}), 0)::int`,
      output: sql<number>`coalesce(sum(${aiUsageLogs.outputTokens}), 0)::int`,
    })
    .from(aiUsageLogs)
    .where(gte(aiUsageLogs.createdAt, start))
    .groupBy(sql`1`);

  const aiByModelRows = await db
    .select({
      provider: aiUsageLogs.provider,
      model: aiUsageLogs.model,
      calls: sql<number>`count(*)::int`,
      cost: sql<number>`coalesce(sum(${aiUsageLogs.costUsd}), 0)::float8`,
    })
    .from(aiUsageLogs)
    .where(gte(aiUsageLogs.createdAt, start))
    .groupBy(aiUsageLogs.provider, aiUsageLogs.model)
    .orderBy(sql`4 desc`);

  const aiByBucketRows = await db
    .select({
      bucket: aiUsageLogs.bucket,
      calls: sql<number>`count(*)::int`,
      cost: sql<number>`coalesce(sum(${aiUsageLogs.costUsd}), 0)::float8`,
    })
    .from(aiUsageLogs)
    .where(gte(aiUsageLogs.createdAt, start))
    .groupBy(aiUsageLogs.bucket);

  // ── 문자: 윈도우 행 로드 후 종류 판정 + KST 일 버킷 ────────────────
  const smsRows = await db
    .select({
      createdAt: notificationLogs.createdAt,
      msgType: sql<string | null>`${notificationLogs.payload}->>'msgType'`,
      text: sql<string | null>`${notificationLogs.payload}->>'text'`,
      subject: sql<string | null>`${notificationLogs.payload}->>'subject'`,
    })
    .from(notificationLogs)
    .where(
      and(
        eq(notificationLogs.channel, 'sms'),
        eq(notificationLogs.status, 'sent'),
        gte(notificationLogs.createdAt, start),
      ),
    );

  // 일 단위 누적 맵
  type Daily = {
    aiCalls: number;
    aiCostUsd: number;
    smsCount: number;
    smsCostKrw: number;
  };
  const daily = new Map<string, Daily>();
  const ensure = (ymd: string): Daily => {
    let d = daily.get(ymd);
    if (!d) {
      d = { aiCalls: 0, aiCostUsd: 0, smsCount: 0, smsCostKrw: 0 };
      daily.set(ymd, d);
    }
    return d;
  };

  let aiCalls = 0;
  let aiCostUsd = 0;
  let aiInputTokens = 0;
  let aiOutputTokens = 0;
  for (const r of aiDailyRows) {
    const d = ensure(r.ymd);
    d.aiCalls += r.calls;
    d.aiCostUsd += r.cost;
    aiCalls += r.calls;
    aiCostUsd += r.cost;
    aiInputTokens += r.input;
    aiOutputTokens += r.output;
  }

  const smsByKind: Record<SmsKind, number> = { sms: 0, lms: 0, mms: 0 };
  let smsCount = 0;
  let smsCostKrw = 0;
  for (const r of smsRows) {
    const kind: SmsKind =
      r.msgType === 'sms' || r.msgType === 'lms' || r.msgType === 'mms'
        ? r.msgType
        : classifySms({ text: r.text ?? '', hasSubject: !!r.subject?.trim() });
    const cost = SMS_PRICING_KRW[kind];
    const ymd = kstYmd(r.createdAt);
    const d = ensure(ymd);
    d.smsCount += 1;
    d.smsCostKrw += cost;
    smsByKind[kind] += 1;
    smsCount += 1;
    smsCostKrw += cost;
  }

  // ── 일 단위 → 기간 버킷 롤업 ──────────────────────────────────────
  const rolled = new Map<string, Daily>();
  for (const [ymd, d] of daily) {
    const k = bucketKeyFor(ymd, period);
    const acc = rolled.get(k) ?? {
      aiCalls: 0,
      aiCostUsd: 0,
      smsCount: 0,
      smsCostKrw: 0,
    };
    acc.aiCalls += d.aiCalls;
    acc.aiCostUsd += d.aiCostUsd;
    acc.smsCount += d.smsCount;
    acc.smsCostKrw += d.smsCostKrw;
    rolled.set(k, acc);
  }

  const buckets: UsageBucket[] = keys.map((key) => {
    const d = rolled.get(key);
    return {
      key,
      label: bucketLabel(key, period),
      aiCalls: d?.aiCalls ?? 0,
      aiCostUsd: d?.aiCostUsd ?? 0,
      smsCount: d?.smsCount ?? 0,
      smsCostKrw: d?.smsCostKrw ?? 0,
    };
  });

  // ── 용도(bucket) → 라벨 병합 (ai-rewrite-* 등 합산) ───────────────
  const byLabel = new Map<string, UsageBucketBreakdown>();
  for (const r of aiByBucketRows) {
    const { label, category } = classifyBucket(r.bucket ?? '');
    const acc = byLabel.get(label) ?? {
      label,
      category,
      buckets: [],
      calls: 0,
      costUsd: 0,
    };
    if (r.bucket && !acc.buckets.includes(r.bucket)) acc.buckets.push(r.bucket);
    acc.calls += r.calls;
    acc.costUsd += r.cost;
    byLabel.set(label, acc);
  }
  const aiByBucket = [...byLabel.values()].sort((a, b) => b.costUsd - a.costUsd);

  return {
    period,
    buckets,
    totals: {
      aiCalls,
      aiCostUsd,
      aiInputTokens,
      aiOutputTokens,
      smsCount,
      smsCostKrw,
      smsByKind,
    },
    aiByModel: aiByModelRows.map((r) => ({
      provider: r.provider,
      model: r.model,
      calls: r.calls,
      costUsd: r.cost,
    })),
    aiByBucket,
    hasAiData: aiCalls > 0,
    generatedAtIso: new Date().toISOString(),
  };
}
