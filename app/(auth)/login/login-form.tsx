'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { signIn, getSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Eye, EyeOff } from 'lucide-react';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { defaultLandingFor } from '@/lib/auth-landing';

export function LoginForm({
  callbackUrl,
  error,
  credentialsEnabled,
  devStubEnabled,
  ssoEnabled,
}: {
  callbackUrl?: string;
  error?: string;
  credentialsEnabled: boolean;
  devStubEnabled: boolean;
  ssoEnabled: boolean;
}) {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(error ?? null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    if (!identifier || !password) {
      setFormError('이메일/아이디와 비밀번호를 모두 입력해주세요');
      return;
    }
    startTransition(async () => {
      const res = await signIn('credentials', {
        identifier,
        password,
        redirect: false,
      });
      if (!res || res.error) {
        const msg =
          res?.error === 'CredentialsSignin'
            ? '이메일/아이디 또는 비밀번호가 일치하지 않습니다'
            : '로그인 중 오류가 발생했습니다';
        setFormError(msg);
        toast.error(msg);
        return;
      }
      toast.success('로그인되었습니다');
      // 역할별 기본 도착지 계산 (callbackUrl이 있으면 그 경로 우선)
      const session = await getSession();
      // 첫 로그인 비밀번호 변경 + 정보 입력 안내 (강제 아님). 기본 비번 사용 시 노출.
      if (session?.user?.mustChangePassword) {
        toast.message('보안을 위해 정보를 업데이트해주세요', {
          description:
            '기본 비밀번호(123456)로 로그인했습니다. 내 프로필에서 비밀번호를 꼭 변경하고, 연락처·이메일 주소 등 정보를 입력해주세요.',
          duration: 10000,
        });
      }
      const destination =
        callbackUrl || defaultLandingFor(session?.user?.role);
      router.push(destination);
      router.refresh();
    });
  }

  return (
    <Card className="w-full max-w-md p-2 sm:p-4">
      <CardHeader className="items-center pb-2 text-center">
        <h1 className="text-2xl font-bold text-black dark:text-white">로그인</h1>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!credentialsEnabled && !ssoEnabled && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
            현재 어떤 로그인 방식도 활성화되어 있지 않습니다. 관리자에게
            문의하세요.
            <br />
            <span className="opacity-70">
              개발자: <code>AUTH_DEV_STUB=true</code> 설정 후 재시작.
            </span>
          </div>
        )}

        {credentialsEnabled && (
          <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="identifier" className="sr-only">
                이메일 또는 아이디
              </Label>
              <Input
                id="identifier"
                type="text"
                required
                autoComplete="username"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="이메일 주소 또는 아이디"
                className="h-[52px] text-base"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password" className="sr-only">
                비밀번호
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="비밀번호"
                  className="h-[52px] pr-12 text-base"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 표시'}
                  aria-pressed={showPassword}
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 transition-colors hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:hover:text-slate-200"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>
            {formError && (
              <div className="rounded-md border border-red-300 bg-red-50 p-2 text-xs text-red-700 dark:border-red-700 dark:bg-red-900/30 dark:text-red-200">
                {formError}
              </div>
            )}
            <Button type="submit" disabled={pending} className="h-12 w-full text-base">
              {pending ? '로그인 중...' : '로그인'}
            </Button>

            <div className="text-center">
              <Link
                href="/forgot-password"
                className="text-xs text-slate-500 underline-offset-2 hover:text-brand-600 hover:underline dark:text-slate-400"
              >
                비밀번호를 잊으셨나요?
              </Link>
            </div>

            {devStubEnabled && (
              <div className="mt-2 rounded-md border border-dashed border-slate-300 bg-slate-50 p-2.5 text-[11px] leading-relaxed text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                <strong>개발 모드 (dev-stub)</strong> 시드 계정:
                <br />
                · admin@oa.local / oa1234! &nbsp;(어드민)
                <br />
                · manager@oa.local / oa1234! &nbsp;(매니저)
                <br />
                · hotelier@oa.local / oa1234! &nbsp;(호텔리어)
              </div>
            )}
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
