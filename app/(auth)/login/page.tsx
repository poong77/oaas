import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { defaultLandingFor } from '@/lib/auth-landing';
import { LoginForm } from './login-form';

export const metadata = { title: '로그인 — OA 통합 AS' };
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
    redirect(params.callbackUrl || defaultLandingFor(session.user.role));
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
