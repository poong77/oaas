'use client';

/**
 * 호텔리어 컨택 패널·헤더 배지를 위한 영업상태 훅.
 *
 * - `/api/business-hours/context`에서 정책(hours + holidays) 페치
 * - 1분 간격으로 calculateBusinessStatus 재호출 (시간 흐름 반영)
 * - 5분 간격으로 정책 데이터 재페치 (어드민이 수정 시 반영)
 *
 * 클라이언트 컴포넌트 어디서나 사용 가능.
 */

import { useEffect, useState } from 'react';
import {
  calculateBusinessStatus,
  type BusinessHoursInput,
  type BusinessStatusResult,
  type HolidayInfo,
} from '@/lib/business-hours/calculate';

type Context = { hours: BusinessHoursInput; holidays: HolidayInfo[] };

type ContextResponse =
  | { ok: true; hours: BusinessHoursInput; holidays: HolidayInfo[]; serverNow: string }
  | { ok: false; message: string };

const TICK_MS = 60_000; // 1분
const REFETCH_MS = 5 * 60_000; // 5분

export type UseBusinessStatus = {
  status: BusinessStatusResult | null;
  /** 현재 적용 중인 정책 (override 머지된 결과). ContactPanel의 운영시간 안내문이 사용 */
  hours: BusinessHoursInput | null;
  /** 정책 데이터 로딩 실패 (운영시간 미설정 등) */
  unavailable: boolean;
};

export function useBusinessStatus(): UseBusinessStatus {
  const [ctx, setCtx] = useState<Context | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [now, setNow] = useState<Date>(() => new Date());

  // 정책 데이터 페치
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch('/api/business-hours/context', {
          cache: 'no-store',
        });
        const json = (await res.json()) as ContextResponse;
        if (cancelled) return;
        if (json.ok) {
          setCtx({ hours: json.hours, holidays: json.holidays });
          setUnavailable(false);
        } else {
          setUnavailable(true);
        }
      } catch (err) {
        console.warn('[useBusinessStatus] context fetch 실패:', err);
        if (!cancelled) setUnavailable(true);
      }
    }

    void load();
    const refetch = setInterval(load, REFETCH_MS);
    return () => {
      cancelled = true;
      clearInterval(refetch);
    };
  }, []);

  // 1분마다 시각 갱신 → 자동 재계산
  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), TICK_MS);
    return () => clearInterval(tick);
  }, []);

  if (!ctx) {
    return { status: null, hours: null, unavailable };
  }

  const status = calculateBusinessStatus({
    now,
    hours: ctx.hours,
    holidays: ctx.holidays,
  });

  return { status, hours: ctx.hours, unavailable };
}
