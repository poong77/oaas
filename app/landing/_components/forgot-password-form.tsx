'use client';

/**
 * ForgotPasswordForm (시안) — 실제 비밀번호 찾기 UI(AC-11)를 그대로 시안화.
 *
 * 단계: 이메일 확인 → 채널 선택(이메일 링크 / 문자 코드) → 인증코드 입력 → 완료.
 * 실제 API(/api/auth/password-reset/*) 대신 전환만 시뮬레이션한 시안.
 * 컴포넌트·레이아웃은 기존 (auth)/forgot-password-form.tsx 와 동일 톤(Card·StepIndicator·ChannelButton).
 */

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  Mail,
  MessageSquare,
  ShieldCheck,
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type Step = 'email' | 'channel' | 'verify' | 'emailSent';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 시안용 마스킹 더미 — 실제로는 lookup-email 응답에서 받음
const MASKED_EMAIL = 'ho****@oapms.com';
const MASKED_PHONE = '010-****-1234';

export function ForgotPasswordForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [maskedTarget, setMaskedTarget] = useState('');

  function lookupEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!EMAIL_RE.test(email.trim())) return;
    setStep('channel');
  }

  function requestReset(channel: 'email' | 'sms') {
    if (channel === 'email') {
      setMaskedTarget(MASKED_EMAIL);
      setStep('emailSent');
    } else {
      setMaskedTarget(MASKED_PHONE);
      setCode('');
      setStep('verify');
    }
  }

  function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== 6) return;
    router.push('/landing/login');
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="items-center gap-2 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600 text-white">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-lg font-bold">비밀번호 찾기</h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            이메일로 본인 계정을 확인하고 인증 후 새 비밀번호를 설정합니다.
          </p>
        </div>
        <StepIndicator step={step} />
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {/* 1단계: 이메일 입력 */}
        {step === 'email' && (
          <form className="flex flex-col gap-2" onSubmit={lookupEmail}>
            <Label htmlFor="reset-email">이메일 주소</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Mail className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="reset-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="가입 시 등록한 이메일"
                  className="pl-8"
                  autoFocus
                />
              </div>
              <Button type="submit" disabled={!EMAIL_RE.test(email.trim())}>
                확인
              </Button>
            </div>
            <p className="text-[11px] text-slate-400">
              계정에 등록된 이메일 주소를 입력해주세요.
            </p>
          </form>
        )}

        {/* 2단계: 채널 선택 */}
        {step === 'channel' && (
          <>
            <BackBar label="이메일 다시 입력" onBack={() => setStep('email')} />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              인증 정보를 받을 방법을 선택해주세요.
            </p>
            <div className="flex flex-col gap-2">
              <ChannelButton
                icon={<Mail className="h-4 w-4" />}
                title="이메일로 재설정 링크 받기"
                target={MASKED_EMAIL}
                onClick={() => requestReset('email')}
              />
              <ChannelButton
                icon={<MessageSquare className="h-4 w-4" />}
                title="문자로 인증코드 받기"
                target={MASKED_PHONE}
                onClick={() => requestReset('sms')}
              />
            </div>
          </>
        )}

        {/* 3단계: 문자 코드 입력 */}
        {step === 'verify' && (
          <>
            <BackBar label="인증코드 입력" onBack={() => setStep('channel')} />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              <strong>{maskedTarget}</strong> 로 보낸 6자리 인증코드를 입력해주세요.
            </p>
            <form className="flex flex-col gap-3" onSubmit={verifyCode}>
              <Input
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                }
                placeholder="000000"
                className="text-center text-lg tracking-[0.5em]"
                autoFocus
              />
              <Button type="submit" disabled={code.length !== 6}>
                인증코드 확인
              </Button>
              <button
                type="button"
                onClick={() => requestReset('sms')}
                className="text-xs text-slate-500 underline-offset-2 hover:underline"
              >
                인증코드 다시 받기
              </button>
            </form>
          </>
        )}

        {/* 이메일 발송 완료 */}
        {step === 'emailSent' && (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            <p className="text-sm font-medium">재설정 링크를 보냈습니다</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              <strong>{maskedTarget}</strong> 로 비밀번호 재설정 링크를 발송했습니다.
              메일을 열어 30분 이내에 새 비밀번호를 설정해주세요.
            </p>
            <Button asChild variant="outline" className="mt-2">
              <Link href="/landing/login">로그인 화면으로</Link>
            </Button>
          </div>
        )}

        {step !== 'emailSent' && (
          <div className="border-t border-slate-100 pt-3 text-center dark:border-slate-800">
            <Link
              href="/landing/login"
              className="text-xs text-slate-500 hover:text-brand-600 dark:text-slate-400"
            >
              로그인 화면으로 돌아가기
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StepIndicator({ step }: { step: Step }) {
  const order: Step[] = ['email', 'channel'];
  const activeIdx =
    step === 'verify' || step === 'emailSent' ? 2 : order.indexOf(step);
  return (
    <div className="flex items-center gap-1.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={cn(
            'h-1.5 w-6 rounded-full transition-colors',
            i <= activeIdx ? 'bg-brand-500' : 'bg-slate-200 dark:bg-slate-700',
          )}
        />
      ))}
    </div>
  );
}

function BackBar({ label, onBack }: { label: string; onBack: () => void }) {
  return (
    <button
      type="button"
      onClick={onBack}
      className="flex items-center gap-1.5 self-start rounded-md px-1.5 py-1 text-xs font-medium text-slate-500 transition-colors hover:text-brand-600 dark:text-slate-400"
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function ChannelButton({
  icon,
  title,
  target,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  target: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3.5 py-3 text-left transition-colors hover:border-brand-400 hover:bg-brand-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-brand-600 dark:bg-brand-900/40">
        {icon}
      </span>
      <span className="flex flex-col">
        <span className="text-sm font-medium">{title}</span>
        <span className="text-[11px] text-slate-400">{target}</span>
      </span>
    </button>
  );
}
