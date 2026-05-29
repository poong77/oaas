'use client';

import { useState, useTransition } from 'react';
import { signIn, getSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { LifeBuoy, Lock, Mail } from 'lucide-react';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { defaultLandingFor } from '@/lib/auth-landing';

export function LoginForm({
  callbackUrl,
  error,
  devStubEnabled,
  ssoEnabled,
}: {
  callbackUrl?: string;
  error?: string;
  devStubEnabled: boolean;
  ssoEnabled: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(error ?? null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    if (!email || !password) {
      setFormError('이메일과 비밀번호를 모두 입력해주세요');
      return;
    }
    startTransition(async () => {
      const res = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });
      if (!res || res.error) {
        const msg =
          res?.error === 'CredentialsSignin'
            ? '이메일 또는 비밀번호가 일치하지 않습니다'
            : '로그인 중 오류가 발생했습니다';
        setFormError(msg);
        toast.error(msg);
        return;
      }
      toast.success('로그인되었습니다');
      // 역할별 기본 도착지 계산 (callbackUrl이 있으면 그 경로 우선)
      const session = await getSession();
      const destination =
        callbackUrl || defaultLandingFor(session?.user?.role);
      router.push(destination);
      router.refresh();
    });
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="items-center gap-3 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600 text-white">
          <LifeBuoy className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-lg font-bold">OA 통합 AS 로그인</h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            support.oapms.com
          </p>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!devStubEnabled && !ssoEnabled && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
            현재 어떤 로그인 방식도 활성화되어 있지 않습니다. 관리자에게
            문의하세요.
            <br />
            <span className="opacity-70">
              개발자: <code>AUTH_DEV_STUB=true</code> 설정 후 재시작.
            </span>
          </div>
        )}

        {devStubEnabled && (
          <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">이메일</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@oa.local"
                  className="pl-8"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">비밀번호</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-8"
                />
              </div>
            </div>
            {formError && (
              <div className="rounded-md border border-red-300 bg-red-50 p-2 text-xs text-red-700 dark:border-red-700 dark:bg-red-900/30 dark:text-red-200">
                {formError}
              </div>
            )}
            <Button type="submit" disabled={pending}>
              {pending ? '로그인 중...' : '로그인'}
            </Button>

            <div className="mt-2 rounded-md border border-dashed border-slate-300 bg-slate-50 p-2.5 text-[11px] leading-relaxed text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
              <strong>개발 모드 (dev-stub)</strong> 시드 계정:
              <br />
              · admin@oa.local / oa1234! &nbsp;(어드민)
              <br />
              · manager@oa.local / oa1234! &nbsp;(매니저)
              <br />
              · hotelier@oa.local / oa1234! &nbsp;(호텔리어)
            </div>
          </form>
        )}

        {ssoEnabled && (
          <Button
            type="button"
            variant="outline"
            disabled
            onClick={() => toast.info('OA SSO는 클레임 명세 확정 후 활성화됩니다.')}
            className="w-full"
          >
            OA PMS SSO로 로그인 (준비 중)
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
