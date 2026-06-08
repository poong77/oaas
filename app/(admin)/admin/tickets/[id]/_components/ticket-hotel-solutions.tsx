'use client';

/**
 * 티켓 상세 우측 사이드 — 숙소가 이용 중인 솔루션 바로가기(컴팩트, 읽기전용).
 *
 * - URL 아웃링크(새 탭) + 로그인 ID 표시
 * - 비밀번호는 어드민만 '보기'(revealSolutionPasswordAction, 감사 로그). 매니저는 ID까지만.
 * - 호텔 마스터 상세의 풀 CRUD(HotelSolutions)와 달리 최소 공간 표시 전용.
 */

import { useState } from 'react';
import { toast } from 'sonner';
import { Eye, EyeOff, ExternalLink, KeyRound } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { revealSolutionPasswordAction } from '@/app/actions/hotel-actions';
import type { HotelSolutionView } from '@/lib/services/hotels';

export function TicketHotelSolutions({
  hotelId,
  solutions,
  canReveal,
}: {
  hotelId: string;
  solutions: HotelSolutionView[];
  canReveal: boolean;
}) {
  const [revealed, setRevealed] = useState<Record<string, string>>({});

  async function toggleReveal(id: string) {
    if (revealed[id] !== undefined) {
      setRevealed((p) => {
        const n = { ...p };
        delete n[id];
        return n;
      });
      return;
    }
    const fd = new FormData();
    fd.set('id', id);
    fd.set('hotelId', hotelId);
    const res = await revealSolutionPasswordAction(fd);
    if (res.ok && res.data) {
      setRevealed((p) => ({ ...p, [id]: res.data!.password }));
    } else {
      toast.error(res.ok ? '비밀번호가 없습니다' : res.error);
    }
  }

  if (solutions.length === 0) return null;

  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-4">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          <KeyRound className="h-3.5 w-3.5" />
          이용 솔루션
        </div>
        <ul className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
          {solutions.map((s) => (
            <li key={s.id} className="flex flex-col gap-1 py-2 first:pt-0 last:pb-0">
              <div className="flex items-center justify-between gap-2">
                <Badge tone="brand" className="shrink-0 text-[11px]">
                  {s.label}
                </Badge>
                {s.url ? (
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 text-xs text-brand-600 hover:underline dark:text-brand-400"
                  >
                    바로가기 <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <span className="text-xs text-slate-400">URL 없음</span>
                )}
              </div>
              {(s.loginId || s.hasPassword) && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-600 dark:text-slate-300">
                  {s.loginId && (
                    <span>
                      <span className="text-slate-400">ID</span>{' '}
                      <span className="font-mono">{s.loginId}</span>
                    </span>
                  )}
                  {s.hasPassword && (
                    <span className="inline-flex items-center gap-1">
                      <span className="text-slate-400">PW</span>{' '}
                      {canReveal ? (
                        <>
                          <span className="font-mono">
                            {revealed[s.id] !== undefined
                              ? revealed[s.id]
                              : '••••••'}
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleReveal(s.id)}
                            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                            aria-label={
                              revealed[s.id] !== undefined ? '숨기기' : '보기'
                            }
                          >
                            {revealed[s.id] !== undefined ? (
                              <EyeOff className="h-3.5 w-3.5" />
                            ) : (
                              <Eye className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </>
                      ) : (
                        <span className="text-slate-400">어드민 전용</span>
                      )}
                    </span>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
