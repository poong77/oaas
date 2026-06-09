import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';

import { auth } from '@/lib/auth';
import { defaultLandingFor } from '@/lib/auth-landing';
import { getResetGrant } from '@/lib/services/password-reset';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ResetPasswordForm } from './reset-password-form';

export const metadata = { title: '새 비밀번호 설정 — OA 통합 AS' };
export const dynamic = 'force-dynamic';

type SearchParams = Promise<{ token?: string }>;

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();
  if (session?.user) {
    redirect(defaultLandingFor(session.user.role));
  }

  const { token } = await searchParams;
  const grant = token ? await getResetGrant(token) : null;

  if (!token || !grant) {
    return (
      <Card className="w-full max-w-sm">
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <AlertTriangle className="h-12 w-12 text-amber-500" />
          <h1 className="text-lg font-bold">유효하지 않은 링크입니다</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            재설정 링크가 만료되었거나 이미 사용되었습니다.
            <br />
            비밀번호 찾기를 다시 진행해주세요.
          </p>
          <Button asChild className="mt-2">
            <Link href="/forgot-password">비밀번호 찾기 다시 시작</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return <ResetPasswordForm token={token} name={grant.name} />;
}
