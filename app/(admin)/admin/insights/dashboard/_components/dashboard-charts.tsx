'use client';

import { useMemo } from 'react';
import { EChart, chartTheme, useIsDark } from './echart';
import type {
  ChannelDaily,
  HotelAgg,
  KeywordAgg,
  ProductAgg,
  TypeAgg,
} from '@/lib/services/insights';

const CHANNEL_COLOR: Record<string, string> = {
  웹: '#0d87ea',
  전화: '#60a5fa',
  챗봇: '#34d399',
  카카오: '#fbbf24',
  이메일: '#a78bfa',
  방문: '#fb923c',
  여럿: '#94a3b8',
};
const PRODUCT_PALETTE = ['#0d87ea', '#60a5fa', '#34d399', '#fbbf24', '#a78bfa', '#fb923c'];

function tooltipBase(t: ReturnType<typeof chartTheme>) {
  return {
    backgroundColor: t.tooltipBg,
    borderColor: t.tooltipBorder,
    textStyle: { color: t.tooltipText, fontSize: 12 },
  };
}

// ── 검색어 워드클라우드 (대표어 기준) ──────────────────────
export function WordcloudChart({ data }: { data: KeywordAgg[] }) {
  const dark = useIsDark();
  const option = useMemo(() => {
  const t = chartTheme(dark);
  const base = dark ? '#93c5fd' : '#0d87ea';
  const soft = dark ? '#64748b' : '#94a3b8';
  const wc = data.map((d) => ({
    name: d.term,
    value: d.count,
    textStyle: {
      color:
        d.zeroRate >= 0.5
          ? '#f43f5e'
          : d.zeroRate >= 0.2
            ? '#f59e0b'
            : d.count >= (data[0]?.count ?? 1) * 0.4
              ? base
              : soft,
    },
  }));
  return {
    backgroundColor: 'transparent',
    tooltip: {
      show: true,
      ...tooltipBase(t),
      formatter: (p: { name: string; value: number }) => `${p.name}: ${p.value}회`,
    },
    series: [
      {
        type: 'wordCloud',
        shape: 'circle',
        left: 'center',
        top: 'center',
        width: '96%',
        height: '96%',
        sizeRange: [13, 50],
        rotationRange: [0, 0],
        gridSize: 8,
        textStyle: { fontFamily: 'Pretendard, sans-serif', fontWeight: 700 },
        emphasis: { textStyle: { textShadowBlur: 4, textShadowColor: 'rgba(0,0,0,.15)' } },
        data: wc,
      },
    ],
  };
  }, [data, dark]);
  return <EChart option={option} height={280} />;
}

// ── 호텔별 문의 Top 15 (가로 막대) ─────────────────────────
export function HotelBarChart({ data }: { data: HotelAgg[] }) {
  const dark = useIsDark();
  const option = useMemo(() => {
  const t = chartTheme(dark);
  const rows = [...data].reverse(); // 큰 값이 위로
  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      ...tooltipBase(t),
      formatter: (p: { name: string; value: number }[]) =>
        `${p[0].name}: ${p[0].value}건`,
    },
    grid: { left: 4, right: 36, top: 6, bottom: 6, containLabel: true },
    xAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: t.axis } },
      axisLabel: { color: t.text, fontSize: 11 },
    },
    yAxis: {
      type: 'category',
      data: rows.map((r) => r.hotelName),
      axisLabel: { color: t.label, fontSize: 12 },
      axisTick: { show: false },
      axisLine: { lineStyle: { color: t.axis } },
    },
    series: [
      {
        type: 'bar',
        barMaxWidth: 16,
        data: rows.map((r) => r.count),
        label: { show: true, position: 'right', color: t.text, fontSize: 11 },
        itemStyle: {
          borderRadius: [0, 4, 4, 0],
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 1,
            y2: 0,
            colorStops: [
              { offset: 0, color: dark ? '#0153a2' : '#79c3fd' },
              { offset: 1, color: '#0d87ea' },
            ],
          },
        },
      },
    ],
  };
  }, [data, dark]);
  return <EChart option={option} height={420} />;
}

// ── 일자별 × 채널별 누적 막대 ──────────────────────────────
export function ChannelStackedChart({ data }: { data: ChannelDaily }) {
  const dark = useIsDark();
  const option = useMemo(() => {
  const t = chartTheme(dark);
  const labels = data.days.map((d) => d.slice(5).replace('-', '/')); // MM/DD
  const lastIdx = data.series.length - 1;
  return {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, ...tooltipBase(t) },
    legend: {
      bottom: 0,
      textStyle: { color: t.text, fontSize: 11 },
      icon: 'circle',
      itemWidth: 8,
      itemHeight: 8,
    },
    grid: { left: 10, right: 10, top: 8, bottom: 44, containLabel: true },
    xAxis: {
      type: 'category',
      data: labels,
      axisLabel: { color: t.text, fontSize: 11 },
      axisLine: { lineStyle: { color: t.axis } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: t.axis } },
      axisLabel: { color: t.text, fontSize: 11 },
    },
    series: data.series.map((s, i) => ({
      name: s.name,
      type: 'bar',
      stack: 's',
      barMaxWidth: 28,
      data: s.data,
      itemStyle: {
        color: CHANNEL_COLOR[s.name] ?? '#94a3b8',
        borderRadius: i === lastIdx ? [3, 3, 0, 0] : [0, 0, 0, 0],
      },
    })),
  };
  }, [data, dark]);
  return <EChart option={option} height={240} />;
}

// ── 제품별 분포 (도넛) ─────────────────────────────────────
export function ProductPieChart({ data }: { data: ProductAgg[] }) {
  const dark = useIsDark();
  const option = useMemo(() => {
  const t = chartTheme(dark);
  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      ...tooltipBase(t),
      formatter: '{b}: {c}건 ({d}%)',
    },
    series: [
      {
        type: 'pie',
        radius: ['40%', '68%'],
        center: ['50%', '46%'],
        label: { color: t.label, fontSize: 11, formatter: '{b}\n{d}%' },
        labelLine: { length: 8, length2: 6, lineStyle: { color: t.text } },
        data: data.map((d, i) => ({
          value: d.count,
          name: d.label,
          itemStyle: { color: PRODUCT_PALETTE[i % PRODUCT_PALETTE.length] },
        })),
      },
    ],
  };
  }, [data, dark]);
  return <EChart option={option} height={240} />;
}

// ── 유형별 (가로 누적 막대: 완료 / 처리중) ─────────────────
export function TypeBarChart({ data }: { data: TypeAgg[] }) {
  const dark = useIsDark();
  const rows = [...data].reverse();
  const option = useMemo(() => {
  const t = chartTheme(dark);
  return {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, ...tooltipBase(t) },
    legend: {
      right: 0,
      top: 0,
      textStyle: { color: t.text, fontSize: 11 },
      icon: 'circle',
      itemWidth: 8,
      itemHeight: 8,
    },
    grid: { left: 10, right: 10, top: 30, bottom: 6, containLabel: true },
    xAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: t.axis } },
      axisLabel: { color: t.text, fontSize: 11 },
    },
    yAxis: {
      type: 'category',
      data: rows.map((r) => r.label),
      axisLabel: { color: t.label, fontSize: 12 },
      axisTick: { show: false },
      axisLine: { lineStyle: { color: t.axis } },
    },
    series: [
      {
        name: '완료',
        type: 'bar',
        stack: 's',
        barMaxWidth: 20,
        data: rows.map((r) => r.completed),
        itemStyle: { color: '#34d399' },
      },
      {
        name: '처리중',
        type: 'bar',
        stack: 's',
        data: rows.map((r) => r.ongoing),
        itemStyle: { color: '#60a5fa', borderRadius: [0, 4, 4, 0] },
      },
    ],
  };
  }, [data, dark]);
  return <EChart option={option} height={Math.max(160, rows.length * 34 + 50)} />;
}
