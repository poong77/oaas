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

import { useState } from 'react';
import Link from 'next/link';
import { Siren } from 'lucide-react';
import { useBusinessStatus } from '@/lib/hooks/use-business-status';
import type {
  BusinessStatusResult,
  BusinessHoursInput,
} from '@/lib/business-hours/calculate';
import {
  formatDateTimeKst,
  formatRemaining,
  formatTimeKst,
} from '@/lib/business-hours/format';
import { resolveStateIcon } from '@/lib/business-hours/state-icons';

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
  const { status, unavailable, hours } = useBusinessStatus();
  // sm 배지 — 모바일(터치)에서 탭으로 툴팁 토글 (hover 미지원 보완)
  const [tipOpen, setTipOpen] = useState(false);

  if (unavailable && hideWhenUnavailable) return null;
  if (!status) return <BadgeSkeleton size={size} />;

  const tone = toneFor(status);

  const Icon = resolveStateIcon(
    status.stateIcons[status.status],
    status.status,
  );

  /*
   * hash-only(#contact 등)는 일반 <a>로 처리 — Next.js Link가 hash navigation을 router로 처리하면서
   * 동일 hash를 반복 클릭할 때마다 URL에 hash를 누적 append하는 이슈가 있음.
   * 브라우저 기본 동작은 동일 hash 재클릭 시 history entry를 추가하지 않으므로 안전.
   */
  const isHashOnly = linkTo.startsWith('#');

  if (size === 'sm') {
    const cls =
      'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition hover:opacity-90 ' +
      TONE_CLASS[tone];
    const label = `운영 상태: ${status.label}`;
    const inner = (
      <>
        <Icon className="h-3.5 w-3.5" />
        <span>{status.label}</span>
      </>
    );
    // 데스크톱은 hover, 모바일은 탭 토글 — 배지를 버튼으로(정보는 툴팁에 모두 노출)
    const badge = (
      <button
        type="button"
        onClick={() => setTipOpen((v) => !v)}
        className={cls}
        aria-label={label}
        aria-expanded={tipOpen}
      >
        {inner}
      </button>
    );

    // 풀 툴팁 (docs/mockups/gnb-status.html 기준)
    const tt = buildTooltip(status, hours);

    return (
      <span className="group relative inline-flex">
        {/* 모바일 탭-아웃 백드롭 */}
        {tipOpen && (
          <button
            type="button"
            aria-label="닫기"
            onClick={() => setTipOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
        )}
        {badge}
        <div
          role="tooltip"
          className={`absolute right-0 top-[calc(100%+12px)] z-50 w-[268px] origin-top transition duration-150 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:scale-100 group-hover:opacity-100 ${
            tipOpen
              ? 'pointer-events-auto translate-y-0 scale-100 opacity-100'
              : 'pointer-events-none -translate-y-1 scale-95 opacity-0'
          }`}
        >
          <div className="relative rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-[0_18px_50px_rgba(20,30,55,0.18)] dark:border-white/10 dark:bg-[#1b1d23] dark:shadow-[0_18px_50px_rgba(0,0,0,0.5)]">
            <span
              aria-hidden
              className="absolute -top-1.5 right-6 h-3 w-3 rotate-45 border-l border-t border-slate-200 bg-white dark:border-white/10 dark:bg-[#1b1d23]"
            />
            <span
              className={`mb-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${tt.headCls}`}
            >
              <Icon className="h-3.5 w-3.5" />
              {status.label}
            </span>
            <p className="text-[15px] font-extrabold tracking-tight text-slate-900 dark:text-white">
              {tt.title}
            </p>
            {tt.sub && (
              <p className="mt-1.5 text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">
                {tt.sub.pre}
                <b className={`font-bold ${tt.sub.accentCls}`}>{tt.sub.strong}</b>
                {tt.sub.post}
              </p>
            )}
            {tt.emergency && (
              <div className="mt-3 flex items-start gap-2 border-t border-slate-100 pt-3 text-[13px] dark:border-white/10">
                <Siren className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                <span className="text-slate-500 dark:text-slate-400">
                  긴급 장애 신고:{' '}
                  <b className="font-extrabold text-rose-500">{tt.emergency.phone}</b>
                  {tt.emergency.note && (
                    <>
                      <br />
                      <span className="text-[11.5px]">{tt.emergency.note}</span>
                    </>
                  )}
                </span>
              </div>
            )}
          </div>
        </div>
      </span>
    );
  }

  // md
  const cls =
    'inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition hover:bg-slate-50 dark:hover:bg-slate-800 ' +
    BORDER_CLASS[tone];
  const inner = (
    <>
      <Icon className="h-3.5 w-3.5" />
      <span className="font-semibold">{status.label}</span>
      <span className="text-xs text-slate-500 dark:text-slate-400">
        {subline(status)}
      </span>
    </>
  );
  return isHashOnly ? (
    <a href={linkTo} className={cls}>
      {inner}
    </a>
  ) : (
    <Link href={linkTo} className={cls}>
      {inner}
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
  // 점심시간: 풀 툴팁 head(HEAD_CLS.blue)와 색상 일치
  lunch: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
  warn: 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300',
  closed: 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
};

const BORDER_CLASS: Record<Tone, string> = {
  open: 'border-emerald-200 text-emerald-700 dark:border-emerald-900 dark:text-emerald-300',
  lunch: 'border-blue-200 text-blue-700 dark:border-blue-900 dark:text-blue-300',
  warn: 'border-orange-200 text-orange-700 dark:border-orange-900 dark:text-orange-300',
  closed: 'border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-300',
};

/** sm 배지 호버 풀 툴팁 모델 (docs/mockups/gnb-status.html). */
type TooltipModel = {
  headCls: string;
  title: string;
  sub: { pre: string; strong: string; post: string; accentCls: string } | null;
  emergency: { phone: string; note: string | null } | null;
};

const HEAD_CLS = {
  emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  slate: 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300',
} as const;
const ACCENT_CLS = {
  emerald: 'text-emerald-600 dark:text-emerald-400',
  blue: 'text-blue-600 dark:text-blue-400',
  amber: 'text-amber-600 dark:text-amber-400',
} as const;

// "HH:MM:SS" → "HH:MM" (이미 HH:MM 형태면 그대로)
function hhmm(t: string): string {
  return t.slice(0, 5);
}

function buildTooltip(
  s: BusinessStatusResult,
  hours: BusinessHoursInput | null,
): TooltipModel {
  const range =
    hours ? `${hhmm(hours.weekdayOpen)}~${hhmm(hours.weekdayClose)}` : null;

  if (s.status === 'open') {
    return {
      headCls: HEAD_CLS.emerald,
      title: range ? `운영 시간 ${range}` : '운영 중',
      sub:
        s.msUntilClose && s.msUntilClose > 0
          ? {
              pre: '마감까지 ',
              strong: formatRemaining(s.msUntilClose, 'long'),
              post: ' 남음',
              accentCls: ACCENT_CLS.emerald,
            }
          : null,
      emergency: null,
    };
  }
  if (s.status === 'lunch') {
    const lunchRange =
      hours?.lunchStart && hours?.lunchEnd
        ? `${hhmm(hours.lunchStart)}~${hhmm(hours.lunchEnd)}`
        : null;
    return {
      headCls: HEAD_CLS.blue,
      title: lunchRange ? `점심시간 ${lunchRange}` : '점심시간',
      sub: {
        pre: '점심시간에는 ',
        strong: '상담이 잠시 쉬어갑니다',
        post: '',
        accentCls: ACCENT_CLS.blue,
      },
      emergency: null,
    };
  }
  if (s.status === 'intake_closed') {
    return {
      headCls: HEAD_CLS.amber,
      title: range ? `운영 시간 ${range}` : '접수 마감',
      sub: {
        pre: '당일 ',
        strong: '접수 마감중',
        post: ' 입니다',
        accentCls: ACCENT_CLS.amber,
      },
      emergency: null,
    };
  }
  // closed
  return {
    headCls: HEAD_CLS.slate,
    title: '상담 운영이 종료되었습니다.',
    sub: null,
    emergency: s.emergencyPhone
      ? {
          phone: s.emergencyPhone,
          note: s.emergencyNote ?? '(단순 문의 및 금액 정정 제외)',
        }
      : null,
  };
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
