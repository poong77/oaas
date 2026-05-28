/**
 * 서비스 상태 UI 메타 (라벨/색상/이모지).
 *
 * client와 server 양쪽에서 import 가능하도록 'server-only' 모듈에서 분리.
 */

import type { ServiceStatusValue } from '@/db/schema';

export const SERVICE_STATUS_META: Record<
  ServiceStatusValue,
  { label: string; tone: 'success' | 'warn' | 'danger' | 'brand'; emoji: string }
> = {
  normal: { label: '정상', tone: 'success', emoji: '●' },
  degraded: { label: '일부 제한', tone: 'warn', emoji: '▲' },
  incident: { label: '장애 발생', tone: 'danger', emoji: '●' },
  maintenance: { label: '점검 중', tone: 'brand', emoji: '■' },
};
