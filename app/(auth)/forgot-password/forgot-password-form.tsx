'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Mail,
  MessageSquare,
  Search,
  ShieldCheck,
  UserRound,
} from 'lucide-react';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type HotelMatch = { hotelId: string; hotelName: string };
type Account = {
  userId: string;
  maskedName: string;
  hasEmail: boolean;
  maskedEmail: string | null;
  hasPhone: boolean;
  maskedPhone: string | null;
};

type Step = 'hotel' | 'account' | 'channel' | 'verify' | 'emailSent';

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return (await res.json()) as T;
}

/** 호텔 검색 최소 글자 수 (공백·하이픈·점 제외 기준). */
const MIN_QUERY_LEN = 3;
/** 공백·하이픈·언더스코어·점·가운뎃점 제외 글자 수 (서버 collapseSpacing과 동일 기준). */
function meaningfulLen(s: string): number {
  return s.replace(/[\s\-_.·]/g, '').length;
}

export function ForgotPasswordForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('hotel');
  const [pending, startTransition] = useTransition();

  // step: hotel
  const [query, setQuery] = useState('');
  const [hotels, setHotels] = useState<HotelMatch[] | null>(null);

  // step: account
  const [hotel, setHotel] = useState<HotelMatch | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);

  // step: channel / verify
  const [account, setAccount] = useState<Account | null>(null);
  const [smsToken, setSmsToken] = useState<string | null>(null);
  const [maskedTarget, setMaskedTarget] = useState<string>('');
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);

  function searchHotels(e: React.FormEvent) {
    e.preventDefault();
    if (meaningfulLen(query) < MIN_QUERY_LEN) return;
    startTransition(async () => {
      const data = await postJson<{ ok: boolean; hotels?: HotelMatch[] }>(
        '/api/auth/password-reset/search-hotels',
        { q: query.trim() },
      );
      if (!data.ok) {
        toast.error('검색 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
        return;
      }
      setHotels(data.hotels ?? []);
    });
  }

  function selectHotel(h: HotelMatch) {
    startTransition(async () => {
      const data = await postJson<{ ok: boolean; accounts?: Account[] }>(
        '/api/auth/password-reset/accounts',
        { hotelId: h.hotelId },
      );
      if (!data.ok) {
        toast.error('계정 조회 중 오류가 발생했습니다.');
        return;
      }
      setHotel(h);
      setAccounts(data.accounts ?? []);
      setStep('account');
    });
  }

  function selectAccount(a: Account) {
    setAccount(a);
    setStep('channel');
  }

  function requestReset(channel: 'email' | 'sms') {
    if (!account) return;
    startTransition(async () => {
      const data = await postJson<
        | { ok: true; channel: 'email' | 'sms'; token?: string; maskedTarget: string }
        | { ok: false; error: string }
      >('/api/auth/password-reset/request', {
        userId: account.userId,
        channel,
      });
      if (!data.ok) {
        toast.error(
          data.error === 'CHANNEL_UNAVAILABLE'
            ? '선택한 방법으로 발송할 수 없습니다.'
            : data.error === 'RATE_LIMITED'
              ? '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.'
              : '발송 중 오류가 발생했습니다.',
        );
        return;
      }
      setMaskedTarget(data.maskedTarget);
      if (data.channel === 'email') {
        setStep('emailSent');
      } else {
        setSmsToken(data.token ?? null);
        setCode('');
        setCodeError(null);
        setStep('verify');
        toast.success('인증코드를 문자로 보냈습니다.');
      }
    });
  }

  function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    if (!smsToken || code.length !== 6) return;
    setCodeError(null);
    startTransition(async () => {
      const data = await postJson<
        | { ok: true; token: string }
        | { ok: false; error: string; remaining?: number }
      >('/api/auth/password-reset/verify-code', { token: smsToken, code });
      if (!data.ok) {
        if (data.error === 'MISMATCH') {
          setCodeError(
            `인증코드가 일치하지 않습니다.${
              data.remaining != null ? ` (${data.remaining}회 남음)` : ''
            }`,
          );
        } else if (data.error === 'TOO_MANY') {
          setCodeError('시도 횟수를 초과했습니다. 처음부터 다시 진행해주세요.');
        } else {
          setCodeError('인증코드가 만료되었습니다. 다시 요청해주세요.');
        }
        return;
      }
      router.push(`/reset-password?token=${encodeURIComponent(data.token)}`);
    });
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
            호텔을 검색해 본인 계정으로 인증 후 새 비밀번호를 설정합니다.
          </p>
        </div>
        <StepIndicator step={step} />
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {/* 1단계: 호텔 검색 */}
        {step === 'hotel' && (
          <>
            <form className="flex flex-col gap-2" onSubmit={searchHotels}>
              <Label htmlFor="hotel-q">호텔명 검색</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="hotel-q"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="예: 더파인호텔 / the fine"
                    className="pl-8"
                    autoFocus
                  />
                </div>
                <Button
                  type="submit"
                  disabled={pending || meaningfulLen(query) < MIN_QUERY_LEN}
                >
                  검색
                </Button>
              </div>
              {query.trim() && meaningfulLen(query) < MIN_QUERY_LEN ? (
                <p className="text-[11px] text-amber-600 dark:text-amber-500">
                  호텔명을 3글자 이상 입력해주세요.
                </p>
              ) : (
                <p className="text-[11px] text-slate-400">
                  3글자 이상 · 띄어쓰기·영문/국문 구분 없이 검색됩니다.
                </p>
              )}
            </form>

            {hotels !== null && (
              <div className="flex flex-col gap-1.5">
                {hotels.length === 0 ? (
                  <EmptyHint
                    icon={<Building2 className="h-5 w-5" />}
                    text="검색 결과가 없습니다. 호텔명을 다시 확인해주세요."
                  />
                ) : (
                  hotels.map((h) => (
                    <button
                      key={h.hotelId}
                      type="button"
                      disabled={pending}
                      onClick={() => selectHotel(h)}
                      className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left text-sm transition-colors hover:border-brand-400 hover:bg-brand-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
                    >
                      <Building2 className="h-4 w-4 shrink-0 text-slate-400" />
                      <span className="font-medium">{h.hotelName}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </>
        )}

        {/* 2단계: 계정 선택 */}
        {step === 'account' && hotel && (
          <>
            <BackBar
              label={hotel.hotelName}
              onBack={() => {
                setStep('hotel');
                setAccounts([]);
              }}
            />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              본인 계정을 선택해주세요.
            </p>
            <div className="flex flex-col gap-1.5">
              {accounts.length === 0 ? (
                <EmptyHint
                  icon={<UserRound className="h-5 w-5" />}
                  text="이 호텔에 비밀번호를 받을 수 있는 계정이 없습니다. 관리자에게 문의해주세요."
                />
              ) : (
                accounts.map((a) => (
                  <button
                    key={a.userId}
                    type="button"
                    onClick={() => selectAccount(a)}
                    className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left text-sm transition-colors hover:border-brand-400 hover:bg-brand-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
                  >
                    <span className="flex items-center gap-2 font-medium">
                      <UserRound className="h-4 w-4 shrink-0 text-slate-400" />
                      {a.maskedName}
                    </span>
                    <span className="pl-6 text-[11px] text-slate-400">
                      {[a.maskedEmail, a.maskedPhone].filter(Boolean).join(' · ')}
                    </span>
                  </button>
                ))
              )}
            </div>
          </>
        )}

        {/* 3단계: 채널 선택 */}
        {step === 'channel' && account && (
          <>
            <BackBar label={account.maskedName} onBack={() => setStep('account')} />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              인증 정보를 받을 방법을 선택해주세요.
            </p>
            <div className="flex flex-col gap-2">
              {account.hasEmail && (
                <ChannelButton
                  icon={<Mail className="h-4 w-4" />}
                  title="이메일로 재설정 링크 받기"
                  target={account.maskedEmail!}
                  disabled={pending}
                  onClick={() => requestReset('email')}
                />
              )}
              {account.hasPhone && (
                <ChannelButton
                  icon={<MessageSquare className="h-4 w-4" />}
                  title="문자로 인증코드 받기"
                  target={account.maskedPhone!}
                  disabled={pending}
                  onClick={() => requestReset('sms')}
                />
              )}
            </div>
          </>
        )}

        {/* 4단계: 문자 코드 입력 */}
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
              {codeError && (
                <div className="rounded-md border border-red-300 bg-red-50 p-2 text-xs text-red-700 dark:border-red-700 dark:bg-red-900/30 dark:text-red-200">
                  {codeError}
                </div>
              )}
              <Button type="submit" disabled={pending || code.length !== 6}>
                {pending ? '확인 중...' : '인증코드 확인'}
              </Button>
              <button
                type="button"
                disabled={pending}
                onClick={() => requestReset('sms')}
                className="text-xs text-slate-500 underline-offset-2 hover:underline disabled:opacity-50"
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
              <Link href="/login">로그인 화면으로</Link>
            </Button>
          </div>
        )}

        {step !== 'emailSent' && (
          <div className="border-t border-slate-100 pt-3 text-center dark:border-slate-800">
            <Link
              href="/login"
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
  const order: Step[] = ['hotel', 'account', 'channel'];
  const activeIdx =
    step === 'verify' || step === 'emailSent' ? 3 : order.indexOf(step);
  return (
    <div className="flex items-center gap-1.5">
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className={cn(
            'h-1.5 w-6 rounded-full transition-colors',
            i <= activeIdx
              ? 'bg-brand-500'
              : 'bg-slate-200 dark:bg-slate-700',
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
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  target: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3.5 py-3 text-left transition-colors hover:border-brand-400 hover:bg-brand-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
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

function EmptyHint({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-xs text-slate-400 dark:border-slate-700">
      {icon}
      <p>{text}</p>
    </div>
  );
}
