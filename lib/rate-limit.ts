/**
 * 인메모리 Rate Limiter (Phase 1 기본 구현).
 *
 * 정책:
 *   - 슬라이딩 윈도우 기반 (1분 단위 bucket)
 *   - 키: `${prefix}:${identifier}` (보통 `${userId}` 또는 `${ip}`)
 *   - Vercel serverless cold start마다 reset되므로 인스턴스 한정 보호
 *   - 폭주 방지에는 충분, 정밀 RL이 필요하면 Upstash로 교체 권장
 *
 * 사용 예:
 *   const { ok, remaining, retryAfter } = checkRateLimit(`upload:${user.id}`, 30);
 *   if (!ok) return NextResponse.json({ ... }, { status: 429, headers: { 'Retry-After': String(retryAfter) }});
 *
 * 후속 (Phase 후): Upstash @upstash/ratelimit 도입 시 본 helper 시그니처 유지하여 교체.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/** 메모리 누수 방지: 만료된 bucket 주기 정리 (lazy, 호출 시점) */
function cleanup(now: number) {
  if (buckets.size < 1000) return; // 작을 때는 skip
  for (const [k, v] of buckets) {
    if (now > v.resetAt) buckets.delete(k);
  }
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  /** 다음 윈도우까지 남은 초 (ok=false일 때 의미) */
  retryAfter: number;
}

/**
 * Rate Limit 체크 + 카운트 증가.
 *
 * @param key 식별자 (예: `upload:${userId}` / `draft:${userId}`)
 * @param maxPerMinute 분당 허용 횟수 (기본 30)
 */
export function checkRateLimit(key: string, maxPerMinute = 30): RateLimitResult {
  const now = Date.now();
  cleanup(now);

  const bucket = buckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + 60_000 });
    return { ok: true, remaining: maxPerMinute - 1, retryAfter: 0 };
  }

  if (bucket.count >= maxPerMinute) {
    return {
      ok: false,
      remaining: 0,
      retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  bucket.count++;
  return {
    ok: true,
    remaining: maxPerMinute - bucket.count,
    retryAfter: 0,
  };
}

/** 테스트/개발용 — 모든 bucket 초기화 */
export function resetRateLimit() {
  buckets.clear();
}
