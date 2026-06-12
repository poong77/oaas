import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { defaultLandingFor } from '@/lib/auth-landing';
import { LoginForm } from './login-form';

export const metadata = { title: '로그인 — OA서포트' };
export const dynamic = 'force-dynamic';

type SearchParams = Promise<{ callbackUrl?: string; error?: string }>;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();
  const params = await searchParams;
  if (session?.user) {
    // login-form.tsx 와 동일 정책: 어드민·매니저는 /admin callbackUrl만 존중,
    // 호텔리어는 항상 역할 기본 화면(홈)으로. 깨진 공지 callbackUrl로 인한 빈 페이지 방지.
    const role = session.user.role;
    const isStaff = role === 'admin' || role === 'manager';
    const dest =
      isStaff && params.callbackUrl?.startsWith('/admin')
        ? params.callbackUrl
        : defaultLandingFor(role);
    redirect(dest);
  }

  const devStubEnabled =
    (process.env.AUTH_DEV_STUB ?? '').toLowerCase() === 'true';
  // 비밀번호 로그인은 운영 기본 수단으로 항상 활성화 (lib/auth.ts 와 동일 정책).
  const credentialsEnabled = true;
  const ssoEnabled = !!process.env.OA_SSO_ISSUER;

  return (
    <LoginForm
      callbackUrl={params.callbackUrl}
      error={params.error}
      credentialsEnabled={credentialsEnabled}
      devStubEnabled={devStubEnabled}
      ssoEnabled={ssoEnabled}
    />
  );
}
