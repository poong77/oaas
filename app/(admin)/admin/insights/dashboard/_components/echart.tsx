'use client';

import { useEffect, useRef, useState } from 'react';
import type { ECharts } from 'echarts';

/**
 * ECharts 클라이언트 래퍼 (DI-01 대시보드 한정).
 * - echarts + echarts-wordcloud를 effect 내 dynamic import (SSR 안전, 코드 분할).
 * - option prop 변경 시 setOption(다크모드 토글 시 위젯이 새 option 전달 → 자동 반영).
 * - ResizeObserver로 반응형.
 */
export function EChart({
  option,
  height = 240,
  className,
  onItemClick,
}: {
  option: Record<string, unknown>;
  height?: number;
  className?: string;
  /** 막대/조각 클릭 시 호출 — params.name(카테고리/계열명)을 전달. */
  onItemClick?: (params: { name: string; seriesName?: string }) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // echarts 인스턴스를 effect 간 공유.
  const chartRef = useRef<ECharts | null>(null);
  // 최신 콜백을 effect 재실행 없이 참조.
  const clickRef = useRef(onItemClick);
  clickRef.current = onItemClick;

  useEffect(() => {
    let disposed = false;
    let ro: ResizeObserver | null = null;
    (async () => {
      const echarts = await import('echarts');
      await import('echarts-wordcloud');
      if (disposed || !ref.current) return;
      const inst = echarts.init(ref.current, undefined, { renderer: 'svg' });
      chartRef.current = inst;
      inst.setOption(option);
      inst.on('click', (p: { name: string; seriesName?: string }) => {
        clickRef.current?.({ name: p.name, seriesName: p.seriesName });
      });
      ro = new ResizeObserver(() => inst.resize());
      ro.observe(ref.current);
    })();
    return () => {
      disposed = true;
      if (ro) ro.disconnect();
      chartRef.current?.dispose();
      chartRef.current = null;
    };
    // 마운트 시 1회 init. option 갱신은 아래 effect에서.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    chartRef.current?.setOption(option, true);
  }, [option]);

  return <div ref={ref} className={className} style={{ height }} />;
}

/** <html class="dark"> 변화를 구독해 다크모드 여부 반환. */
export function useIsDark(): boolean {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const el = document.documentElement;
    const read = () => setDark(el.classList.contains('dark'));
    read();
    const mo = new MutationObserver(read);
    mo.observe(el, { attributes: true, attributeFilter: ['class'] });
    return () => mo.disconnect();
  }, []);
  return dark;
}

/** 차트 공통 테마 색. */
export function chartTheme(dark: boolean) {
  return {
    text: dark ? '#94a3b8' : '#64748b',
    label: dark ? '#cbd5e1' : '#475569',
    axis: dark ? '#1e293b' : '#f1f5f9',
    tooltipBg: dark ? '#0f172a' : '#ffffff',
    tooltipBorder: dark ? '#334155' : '#e2e8f0',
    tooltipText: dark ? '#e2e8f0' : '#0f172a',
  };
}
