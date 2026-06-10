import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { defaultLandingFor } from '@/lib/auth-landing';
import { ForgotPasswordForm } from './forgot-password-form';

export const metadata = { title: '비밀번호 찾기 — OA서포트' };
export const dynamic = 'force-dynamic';

export default async function ForgotPasswordPage() {
  const session = await auth();
  if (session?.user) {
    redirect(defaultLandingFor(session.user.role));
  }
  return <ForgotPasswordForm />;
}
