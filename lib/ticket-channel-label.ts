/**
 * 티켓 채널 라벨/아이콘 헬퍼 (W3 처리).
 *
 * Lucide 동적 import는 tree-shaking 무효화 위험 (~600KB+ 증가)이라
 * 명시적 named import + CHANNEL_ICON_MAP 화이트리스트 사용.
 *
 * 새 아이콘 필요 시: 1) lucide-react named import 추가
 *                    2) CHANNEL_ICON_MAP에 키 등록
 *                    3) 배포 후 어드민이 마스터 폼에서 선택
 */

import {
  Bot,
  Building,
  Footprints,
  Globe,
  Mail,
  MessageCircle,
  MessageSquare,
  Phone,
  Send,
  Smartphone,
  Tag,
  type LucideIcon,
} from 'lucide-react';

import type { TicketChannelRow } from '@/db/schema';

/**
 * 허용된 Lucide 아이콘 화이트리스트.
 * 시드 6종(Globe/Phone/Bot/MessageCircle/Mail/Footprints) +
 * 확장 후보 4종(MessageSquare/Smartphone/Send/Building).
 */
export const CHANNEL_ICON_MAP: Record<string, LucideIcon> = {
  Globe,
  Phone,
  Bot,
  MessageCircle,
  Mail,
  Footprints,
  MessageSquare,
  Smartphone,
  Send,
  Building,
};

export const FALLBACK_ICON: LucideIcon = Tag;

export type ChannelDisplay = {
  code: string;
  label: string;
  Icon: LucideIcon;
  /** 마스터에서 누락된 케이스 (raw code를 label로 fallback) */
  isOrphan: boolean;
};

export function getChannelDisplay(
  code: string,
  map: Map<string, TicketChannelRow>,
): ChannelDisplay {
  const row = map.get(code);
  if (!row) {
    return { code, label: code, Icon: FALLBACK_ICON, isOrphan: true };
  }
  const Icon = row.icon
    ? (CHANNEL_ICON_MAP[row.icon] ?? FALLBACK_ICON)
    : FALLBACK_ICON;
  return { code, label: row.label, Icon, isOrphan: false };
}

/** 어드민 폼 — 아이콘 선택 콤보박스용. */
export const CHANNEL_ICON_KEYS = Object.keys(CHANNEL_ICON_MAP).sort();
