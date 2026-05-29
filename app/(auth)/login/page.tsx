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
  const ssoEnabled = !!process.env.OA_SSO_ISSUER;

  return (
    <LoginForm
      callbackUrl={params.callbackUrl}
      error={params.error}
      devStubEnabled={devStubEnabled}
      ssoEnabled={ssoEnabled}
    />
  );
}
