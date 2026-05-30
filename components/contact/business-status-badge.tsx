'use client';

/**
 * BusinessStatusBadge — 실시간 운영상태 뱃지.
 *
 * 사이즈:
 *   - sm: 헤더용 점 + 라벨 ("● 운영 중")
 *   - md: 사이드바·푸터용 라벨 + 보조 정보 ("● 운영 중 · 마감까지 2h")
 *
 * 클릭하면 도움말 페이지(또는 컨택 패널)로 이동. linkTo로 커스텀 가능.
 */

import Link from 'next/link';
import { CircleDot, Coffee, DoorClosed, OctagonAlert } from 'lucide-react';

import { useBusinessStatus } from '@/lib/hooks/use-business-status';
import type { BusinessStatusResult } from '@/lib/business-hours/calculate';
import {
  formatDateTimeKst,
  formatRemaining,
  formatTimeKst,
} from '@/lib/business-hours/format';

type Size = 'sm' | 'md';

type Props = {
  size?: Size;
  /** 클릭 시 이동할 경로 (기본: /support#hours) */
  linkTo?: string;
  /** 정책 미설정 등 unavailable이면 아예 숨김 */
  hideWhenUnavailable?: boolean;
};

export function BusinessStatusBadge({
  size = 'sm',
  linkTo = '/support#hours',
  hideWhenUnavailable = true,
}: Props) {
  const { status, unavailable } = useBusinessStatus();

  if (unavailable && hideWhenUnavailable) return null;
  if (!status) return <BadgeSkeleton size={size} />;

  const tone = toneFor(status);

  if (size === 'sm') {
    return (
      <Link
        href={linkTo}
        className={
          'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition hover:opacity-90 ' +
          TONE_CLASS[tone]
        }
        aria-label={`운영 상태: ${status.label}`}
      >
        <Dot tone={tone} />
        <span>{status.label}</span>
      </Link>
    );
  }

  // md
  return (
    <Link
      href={linkTo}
      className={
        'inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition hover:bg-slate-50 dark:hover:bg-slate-800 ' +
        BORDER_CLASS[tone]
      }
    >
      <Dot tone={tone} />
      <span className="font-semibold">{status.label}</span>
      <span className="text-xs text-slate-500 dark:text-slate-400">
        {subline(status)}
      </span>
    </Link>
  );
}

// ─────────────────────────────────────────────────────────────────
// helpers
// ─────────────────────────────────────────────────────────────────

type Tone = 'open' | 'lunch' | 'warn' | 'closed';

function toneFor(s: BusinessStatusResult): Tone {
  if (s.status === 'open') return 'open';
  if (s.status === 'lunch') return 'lunch';
  if (s.status === 'intake_closed') return 'warn';
  return 'closed';
}

const TONE_CLASS: Record<Tone, string> = {
  open: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  lunch: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  warn: 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300',
  closed: 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
};

const BORDER_CLASS: Record<Tone, string> = {
  open: 'border-emerald-200 text-emerald-700 dark:border-emerald-900 dark:text-emerald-300',
  lunch: 'border-amber-200 text-amber-700 dark:border-amber-900 dark:text-amber-300',
  warn: 'border-orange-200 text-orange-700 dark:border-orange-900 dark:text-orange-300',
  closed: 'border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-300',
};

function Dot({ tone }: { tone: Tone }) {
  const Icon =
    tone === 'open'
      ? CircleDot
      : tone === 'lunch'
        ? Coffee
        : tone === 'warn'
          ? OctagonAlert
          : DoorClosed;
  return <Icon className="h-3 w-3" />;
}

function subline(s: BusinessStatusResult): string {
  if (s.status === 'open') {
    if (s.msUntilIntakeClose !== null && s.msUntilIntakeClose > 0) {
      return `접수 마감 ${formatRemaining(s.msUntilIntakeClose, 'short')}`;
    }
    return s.msUntilClose
      ? `마감 ${formatRemaining(s.msUntilClose, 'short')}`
      : '';
  }
  if (s.status === 'lunch') {
    return s.nextOpenAt ? `${formatTimeKst(s.nextOpenAt)} 재개` : '점심시간';
  }
  if (s.status === 'intake_closed') {
    return '당일 접수 마감';
  }
  // closed
  return s.nextOpenAt ? `다음 ${formatDateTimeKst(s.nextOpenAt)}` : '';
}

function BadgeSkeleton({ size }: { size: Size }) {
  return (
    <span
      className={
        size === 'sm'
          ? 'inline-flex h-6 w-20 animate-pulse rounded-full bg-slate-100 dark:bg-slate-800'
          : 'inline-flex h-9 w-40 animate-pulse rounded-md border border-slate-200 dark:border-slate-700'
      }
      aria-hidden
    />
  );
}
