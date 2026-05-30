/**
 * 운영시간 표시 유틸 — 여러 컴포넌트·서비스에서 공유.
 *
 * 추출 사유 (PDCA simplify, 2026-05-30):
 *   - 동일 함수가 4~5곳에 중복되어 있었음 (`trim`/`trimTime`/`remaining`/`formatRemaining`/`todayKst`)
 *   - 한 곳에서 import하도록 통합
 *
 * 모든 함수는 순수. KST 기준 처리.
 */

/** PostgreSQL `time` 컬럼은 'HH:MM:SS' 형식 — `<input type="time">`은 'HH:MM' 필요 */
export function toHHMM(t: string | null | undefined): string {
  if (!t) return '';
  return t.slice(0, 5);
}

/**
 * 남은 시간(ms)을 "Xh Ym" / "X시간 Y분" / "Y분" 형식으로 포맷.
 * @param style 'short' = "Xh Ym", 'long' = "X시간 Y분"
 */
export function formatRemaining(
  ms: number,
  style: 'short' | 'long' = 'long',
): string {
  const totalMin = Math.max(0, Math.floor(ms / 60_000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}분`;
  if (m === 0) return style === 'short' ? `${h}h` : `${h}시간`;
  return style === 'short' ? `${h}h ${m}m` : `${h}시간 ${m}분`;
}

/** 현재 KST 날짜 'YYYY-MM-DD'. cron·서비스·UI에서 공통 사용. */
export function todayKst(now: Date = new Date()): string {
  return now
    .toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' })
    .slice(0, 10);
}

/** KST 기준 시각 'HH:MM' 포맷 (Date → "14:30"). */
export function formatTimeKst(d: Date): string {
  return d.toLocaleTimeString('ko-KR', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/** KST 기준 날짜+시각 한국어 포맷 ("6월 1일 (월) 10:00"). */
export function formatDateTimeKst(d: Date): string {
  return d.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}
