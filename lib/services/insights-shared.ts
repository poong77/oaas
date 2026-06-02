/**
 * DI-01 대시보드 — 클라이언트/서버 공용 상수·타입.
 * 'server-only' 의존(예: db, notifications) 없이 클라이언트 컴포넌트에서도 import 가능.
 */

export type DashboardPeriod = 'yesterday' | '7d' | '30d';

export const DASHBOARD_PERIODS: DashboardPeriod[] = ['yesterday', '7d', '30d'];

export const PERIOD_LABEL: Record<DashboardPeriod, string> = {
  yesterday: '어제',
  '7d': '최근 7일',
  '30d': '최근 30일',
};
