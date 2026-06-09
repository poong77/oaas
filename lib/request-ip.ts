/**
 * 요청 클라이언트 IP 추출 (Vercel/프록시 환경).
 *
 * x-forwarded-for 는 "client, proxy1, proxy2" 형태일 수 있어 첫 값을 사용.
 * 없으면 x-real-ip → 'unknown'.
 */
export function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.headers.get('x-real-ip')?.trim() || 'unknown';
}
