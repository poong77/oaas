/**
 * 로그인 ID 표시 헬퍼.
 *
 * AS 이관 사용자 중 실제 이메일이 없는 계정은 `{아이디}@as.local` 더미 이메일을 가진다.
 * 화면에 "ID"를 보여줄 때는 이 합성 도메인을 제거해 깔끔한 로그인 아이디만 노출한다.
 *   - vstay@as.local → vstay
 *   - opus7710@gmail.com → opus7710@gmail.com (실이메일은 그대로)
 */

/** 더미 도메인 (@as.local) — 실제 메일 발송 대상이 아닌 내부 식별용. */
export const DUMMY_EMAIL_DOMAIN = '@as.local';

/** 더미 @as.local 이메일 여부. */
export function isDummyEmail(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase().endsWith(DUMMY_EMAIL_DOMAIN);
}

/** 표시용 로그인 ID — 이메일에서 @as.local 만 제거. */
export function toLoginId(email: string | null | undefined): string {
  if (!email) return '';
  return isDummyEmail(email)
    ? email.slice(0, -DUMMY_EMAIL_DOMAIN.length)
    : email;
}
