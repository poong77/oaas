'use client';

/**
 * 문의 관리 상단 상태 요약 카드 (클릭형 바로가기).
 *
 * 전체 / 미처리 / 처리중 / 완료 / P1 긴급 — 클릭 시 해당 상태의 목록(/admin/tickets)으로
 * 이동(기존 필터 유지). 상태 필터 탭을 대체한다(중복 제거).
 * 칸반 화면에서도 노출되며, 클릭하면 목록 뷰로 전환된다.
 */

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { CheckCircle2, Clock, Flame, Hourglass, LayoutList } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type Tone = 'slate' | 'brand' | 'warn' | 'success' | 'danger';

const TONE_BADGE: Record<Tone, string> = {
  slate: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  brand: 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300',
  warn: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  success:
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  danger: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

const TONE_RING: Record<Tone, string> = {
  slate: 'ring-slate-400 dark:ring-slate-500',
  brand: 'ring-brand-500',
  warn: 'ring-amber-500',
  success: 'ring-emerald-500',
  danger: 'ring-red-500',
};

export function TicketsSummaryCards({
  total,
  received,
  inProgress,
  completed,
  p1Urgent,
}: {
  total: number;
  received: number;
  inProgress: number;
  completed: number;
  p1Urgent: number;
}) {
  const pathname = usePathname();
  const sp = useSearchParams();
  // 활성 강조는 목록 화면(/admin/tickets)에서만. 칸반에선 강조 없음.
  const onList = pathname === '/admin/tickets';
  const curStatus = sp.get('status') ?? 'received';
  const isP1 = sp.get('urgency') === 'p1';

  function buildHref(next: Record<string, string | null>): string {
    const params = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v === null) params.delete(k);
      else params.set(k, v);
    }
    params.delete('page');
    const qs = params.toString();
    return `/admin/tickets${qs ? `?${qs}` : ''}`;
  }

  const cards: Array<{
    key: string;
    label: string;
    value: number;
    icon: React.ReactNode;
    tone: Tone;
    href: string;
    active: boolean;
  }> = [
    {
      key: 'all',
      label: '전체',
      value: total,
      icon: <LayoutList className="h-4 w-4" />,
      tone: 'slate',
      href: buildHref({ status: 'all', urgency: null }),
      active: onList && !isP1 && curStatus === 'all',
    },
    {
      key: 'received',
      label: '미처리',
      value: received,
      icon: <Clock className="h-4 w-4" />,
      tone: 'brand',
      href: buildHref({ status: 'received', urgency: null }),
      active: onList && !isP1 && curStatus === 'received',
    },
    {
      key: 'in_progress',
      label: '처리중',
      value: inProgress,
      icon: <Hourglass className="h-4 w-4" />,
      tone: 'warn',
      href: buildHref({ status: 'in_progress', urgency: null }),
      active: onList && !isP1 && curStatus === 'in_progress',
    },
    {
      key: 'completed',
      label: '완료',
      value: completed,
      icon: <CheckCircle2 className="h-4 w-4" />,
      tone: 'success',
      href: buildHref({ status: 'completed', urgency: null }),
      active: onList && !isP1 && curStatus === 'completed',
    },
    {
      key: 'p1',
      label: 'P1 긴급',
      value: p1Urgent,
      icon: <Flame className="h-4 w-4" />,
      tone: 'danger',
      href: buildHref({ status: 'all', urgency: 'p1' }),
      active: onList && isP1,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((c) => (
        <Link
          key={c.key}
          href={c.href}
          aria-current={c.active ? 'true' : undefined}
          className={cn(
            'group rounded-xl outline-none transition-all focus-visible:ring-2 focus-visible:ring-brand-500',
            c.active && `ring-2 ${TONE_RING[c.tone]}`,
          )}
        >
          <Card
            className={cn(
              'relative overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-md',
              c.active && 'border-transparent',
            )}
          >
            <CardContent className="flex flex-col gap-1 p-4">
              <div
                className={cn(
                  'inline-flex w-fit items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium',
                  TONE_BADGE[c.tone],
                )}
              >
                {c.icon}
                {c.label}
              </div>
              <div className="text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-50">
                {c.value}
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
