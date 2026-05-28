import { CheckCircle2, Clock, Flame, Hourglass } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function TicketsSummaryCards({
  p1Urgent,
  inProgress,
  pending,
  todayCompleted,
}: {
  p1Urgent: number;
  inProgress: number;
  pending: number;
  todayCompleted: number;
}) {
  const cards = [
    {
      key: 'urgent',
      label: 'P1 긴급',
      value: p1Urgent,
      icon: <Flame className="h-4 w-4" />,
      tone: 'danger' as const,
    },
    {
      key: 'pending',
      label: '미처리',
      value: pending,
      icon: <Clock className="h-4 w-4" />,
      tone: 'brand' as const,
    },
    {
      key: 'in_progress',
      label: '처리중',
      value: inProgress,
      icon: <Hourglass className="h-4 w-4" />,
      tone: 'warn' as const,
    },
    {
      key: 'today_done',
      label: '오늘 완료',
      value: todayCompleted,
      icon: <CheckCircle2 className="h-4 w-4" />,
      tone: 'success' as const,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cards.map((c) => (
        <Card key={c.key} className={cn('relative overflow-hidden')}>
          <CardContent className="flex flex-col gap-1 p-4">
            <div
              className={cn(
                'inline-flex w-fit items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium',
                c.tone === 'danger' &&
                  'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
                c.tone === 'brand' &&
                  'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300',
                c.tone === 'warn' &&
                  'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
                c.tone === 'success' &&
                  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
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
      ))}
    </div>
  );
}
