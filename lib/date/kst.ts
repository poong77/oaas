/**
 * KST(Asia/Seoul) 날짜 유틸 — 서버/클라 공용.
 * 한국은 DST 없음 → toLocaleString('sv-SE') 기반 'YYYY-MM-DD' 추출이 안정적.
 */

/** Date → KST 'YYYY-MM-DD'. */
export function kstYmd(d: Date): string {
  return d.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
}
