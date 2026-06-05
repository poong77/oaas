/**
 * KST(Asia/Seoul) 날짜 유틸 — 서버/클라 공용.
 * 한국은 DST 없음 → toLocaleString('sv-SE') 기반 'YYYY-MM-DD' 추출이 안정적.
 */

/** Date → KST 'YYYY-MM-DD'. */
export function kstYmd(d: Date): string {
  return d.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
}

/**
 * Date → KST 'YYYY-MM-DDTHH:mm' (`<input type="datetime-local">` 표시용).
 * 서버 TZ(UTC)에 의존하지 않고 항상 한국시간으로 표시한다.
 */
export function kstDateTimeLocal(d: Date): string {
  // sv-SE → 'YYYY-MM-DD HH:mm:ss'
  return d
    .toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' })
    .slice(0, 16)
    .replace(' ', 'T');
}

/**
 * datetime-local 입력값('YYYY-MM-DDTHH:mm', 오프셋 없음)을
 * KST 벽시각으로 못박아 파싱한다. (한국은 DST 없음 → +09:00 고정)
 * 서버 TZ가 UTC라도 사용자가 입력한 한국시간 그대로 저장된다.
 */
export function parseKstDateTimeLocal(
  value: string | null | undefined,
): Date | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value.trim());
  if (!m) return null;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00+09:00`);
  return isNaN(d.getTime()) ? null : d;
}
