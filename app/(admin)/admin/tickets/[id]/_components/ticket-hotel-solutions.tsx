'use client';

/**
 * 티켓 상세 우측 사이드 — 숙소가 이용 중인 솔루션 바로가기(컴팩트, 읽기전용).
 *
 * - '바로가기' 클릭 = ID를 클립보드 복사 + 새 탭으로 솔루션 열기.
 *   대상 솔루션은 별도 도메인이라 cross-origin으로 폼 자동입력이 불가하므로,
 *   클립보드 복사 후 사용자가 붙여넣는 방식으로 "미리 입력"을 대체한다.
 *   클립보드는 한 번에 한 값만 담기므로 토스트의 '비밀번호 복사' 액션으로 PW를 이어서 복사.
 * - ID/PW 옆 복사 버튼으로도 개별 복사 가능.
 * - 화면 평문 노출(eye)은 어드민만(canReveal). 비밀번호 복사는 어드민+매니저(canCopyPassword).
 */

import { useState } from 'react';
import { toast } from 'sonner';
import { Eye, EyeOff, ExternalLink, KeyRound, Copy } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  revealSolutionPasswordAction,
  copySolutionPasswordAction,
} from '@/app/actions/hotel-actions';
import type { HotelSolutionView } from '@/lib/services/hotels';

/** 클립보드 복사 (보안 컨텍스트 우선, 실패 시 execCommand 폴백). */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* 폴백 */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

export function TicketHotelSolutions({
  hotelId,
  solutions,
  canReveal,
  canCopyPassword,
}: {
  hotelId: string;
  solutions: HotelSolutionView[];
  canReveal: boolean;
  canCopyPassword: boolean;
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

  /** PW를 복호화해 클립보드에 복사 (화면에 그리지 않음). */
  async function copyPassword(id: string) {
    const fd = new FormData();
    fd.set('id', id);
    fd.set('hotelId', hotelId);
    const res = await copySolutionPasswordAction(fd);
    if (!res.ok || !res.data) {
      toast.error(res.ok ? '비밀번호가 없습니다' : res.error);
      return;
    }
    const ok = await copyText(res.data.password);
    toast[ok ? 'success' : 'error'](
      ok ? '비밀번호가 복사되었습니다. 로그인 창에 붙여넣으세요.' : '복사에 실패했습니다',
    );
  }

  /** 바로가기: ID 복사 + 새 탭 열기 + (PW 있으면) 토스트로 PW 복사 안내. */
  function openSolution(s: HotelSolutionView) {
    // 사용자 제스처 유지를 위해 클립보드/새 탭 열기를 동기적으로 시작.
    if (s.loginId) void copyText(s.loginId);
    if (s.url) window.open(s.url, '_blank', 'noopener,noreferrer');

    const showPwAction = s.hasPassword && canCopyPassword;
    if (s.loginId) {
      toast.success('ID가 복사되었습니다. 로그인 창에 붙여넣으세요.', {
        action: showPwAction
          ? { label: '비밀번호 복사', onClick: () => void copyPassword(s.id) }
          : undefined,
      });
    } else if (showPwAction) {
      toast('로그인 ID가 없습니다.', {
        action: { label: '비밀번호 복사', onClick: () => void copyPassword(s.id) },
      });
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
                  <button
                    type="button"
                    onClick={() => openSolution(s)}
                    className="inline-flex items-center gap-0.5 text-xs text-brand-600 hover:underline dark:text-brand-400"
                    title="ID 복사 후 새 탭으로 열기"
                  >
                    바로가기 <ExternalLink className="h-3 w-3" />
                  </button>
                ) : (
                  <span className="text-xs text-slate-400 dark:text-slate-500">URL 없음</span>
                )}
              </div>
              {(s.loginId || s.hasPassword) && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-600 dark:text-slate-300">
                  {s.loginId && (
                    <span className="inline-flex items-center gap-1">
                      <span className="text-slate-400 dark:text-slate-500">ID</span>{' '}
                      <span className="font-mono">{s.loginId}</span>
                      <button
                        type="button"
                        onClick={async () => {
                          const ok = await copyText(s.loginId!);
                          toast[ok ? 'success' : 'error'](
                            ok ? 'ID가 복사되었습니다.' : '복사에 실패했습니다',
                          );
                        }}
                        className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-200"
                        aria-label="ID 복사"
                        title="ID 복사"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  )}
                  {s.hasPassword && (
                    <span className="inline-flex items-center gap-1">
                      <span className="text-slate-400 dark:text-slate-500">PW</span>{' '}
                      {canReveal ? (
                        <>
                          <span className="font-mono">
                            {revealed[s.id] !== undefined ? revealed[s.id] : '••••••'}
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleReveal(s.id)}
                            className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-200"
                            aria-label={revealed[s.id] !== undefined ? '숨기기' : '보기'}
                            title={revealed[s.id] !== undefined ? '숨기기' : '보기'}
                          >
                            {revealed[s.id] !== undefined ? (
                              <EyeOff className="h-3.5 w-3.5" />
                            ) : (
                              <Eye className="h-3.5 w-3.5" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => void copyPassword(s.id)}
                            className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-200"
                            aria-label="비밀번호 복사"
                            title="비밀번호 복사"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        </>
                      ) : canCopyPassword ? (
                        <>
                          <span className="font-mono">••••••</span>
                          <button
                            type="button"
                            onClick={() => void copyPassword(s.id)}
                            className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-200"
                            aria-label="비밀번호 복사"
                            title="비밀번호 복사"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        </>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500">어드민 전용</span>
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
