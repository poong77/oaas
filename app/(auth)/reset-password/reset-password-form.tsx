'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { CheckCircle2, Eye, EyeOff, Lock } from 'lucide-react';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function isStrongPassword(pw: string): boolean {
  return pw.length >= 8 && /[a-zA-Z]/.test(pw) && /[0-9]/.test(pw);
}

export function ResetPasswordForm({
  token,
  name,
}: {
  token: string;
  name: string;
}) {
  const router = useRouter();
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  const strong = useMemo(() => isStrongPassword(pw), [pw]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!strong) {
      setError('비밀번호는 8자 이상이며 영문과 숫자를 포함해야 합니다.');
      return;
    }
    if (pw !== confirm) {
      setError('비밀번호 확인이 일치하지 않습니다.');
      return;
    }
    startTransition(async () => {
      const res = await fetch('/api/auth/password-reset/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: pw }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!data.ok) {
        if (data.error === 'WEAK_PASSWORD') {
          setError('비밀번호는 8자 이상이며 영문과 숫자를 포함해야 합니다.');
        } else if (data.error === 'INVALID_TOKEN') {
          setError(
            '재설정 링크가 만료되었거나 이미 사용되었습니다. 처음부터 다시 진행해주세요.',
          );
        } else {
          setError('비밀번호 변경 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
        }
        return;
      }
      setDone(true);
      toast.success('비밀번호가 변경되었습니다.');
      setTimeout(() => router.push('/login'), 1800);
    });
  }

  if (done) {
    return (
      <Card className="w-full max-w-[436px] rounded-xl p-12 shadow-none">
        <div className="flex flex-col items-center gap-3 text-center">
          <CheckCircle2 className="h-12 w-12 text-brand-500" />
          <h1 className="text-2xl font-bold text-black dark:text-white">
            비밀번호 변경 완료
          </h1>
          <p className="text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">
            새 비밀번호로 로그인해주세요. 잠시 후 로그인 화면으로 이동합니다.
          </p>
          <Button
            asChild
            className="mt-2 h-[52px] w-full rounded-lg px-5 text-base shadow-none"
          >
            <Link href="/login">지금 로그인하기</Link>
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-[436px] rounded-xl p-12 shadow-none">
      <div className="flex flex-col gap-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-black dark:text-white">
            새 비밀번호 설정
          </h1>
          <p className="mt-2 text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">
            {name}님, 새 비밀번호를 입력해주세요.
          </p>
        </div>
        <form className="flex flex-col gap-3" onSubmit={submit}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pw" className="sr-only">
              새 비밀번호
            </Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <Input
                id="pw"
                type={show ? 'text' : 'password'}
                autoComplete="new-password"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                placeholder="새 비밀번호 (8자 이상, 영문+숫자)"
                className="h-[52px] rounded-lg border-[#DCDEE3] pl-12 pr-12 text-base shadow-none dark:border-slate-700"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                tabIndex={-1}
                aria-label={show ? '비밀번호 숨기기' : '비밀번호 표시'}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 transition-colors hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:hover:text-slate-200"
              >
                {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirm" className="sr-only">
              새 비밀번호 확인
            </Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <Input
                id="confirm"
                type={show ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="새 비밀번호 확인"
                className="h-[52px] rounded-lg border-[#DCDEE3] pl-12 pr-4 text-base shadow-none dark:border-slate-700"
              />
            </div>
          </div>
          {error && (
            <div className="rounded-md border border-red-300 bg-red-50 p-2 text-xs text-red-700 dark:border-red-700 dark:bg-red-900/30 dark:text-red-200">
              {error}
            </div>
          )}
          <Button
            type="submit"
            disabled={pending || !pw || !confirm}
            className="h-[52px] w-full rounded-lg px-5 text-base shadow-none"
          >
            {pending ? '변경 중...' : '비밀번호 변경'}
          </Button>
        </form>

        <div className="border-t border-slate-100 pt-4 text-center dark:border-slate-800">
          <Link
            href="/login"
            className="text-xs text-slate-500 underline-offset-2 hover:text-brand-600 hover:underline dark:text-slate-400"
          >
            로그인 화면으로 돌아가기
          </Link>
        </div>
      </div>
    </Card>
  );
}
