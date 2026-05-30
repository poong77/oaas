/**
 * 운영 상태(open/lunch/intake_closed/closed)별 아이콘 화이트리스트.
 *
 * 어드민이 `business_hours_default.state_icons` jsonb에 저장하는 값은
 * lucide-react 컴포넌트 이름(PascalCase 문자열). 임의 값 차단을 위해
 * 본 화이트리스트(`STATE_ICON_MAP`)에 없는 이름은 fallback 기본값 사용.
 *
 * 사이즈는 사용처가 결정한다 (헤더 14px / 어드민 미리보기 20px / 사이드바 16px 등).
 * 이 파일은 컴포넌트 매핑만 담당.
 *
 * 후보 선정 기준:
 *  - lucide-react v0.x 표준 아이콘 (stroke-width 2 통일)
 *  - 의미가 명확하고 헤더 다른 아이콘(Sun/Moon/User/LogOut/Menu)과 시각 충돌 없는 것
 *  - 각 상태별 4종 추천 (어드민 Select 옵션 길이 적정)
 */

import {
  // open 후보
  Activity,
  CircleDot,
  Headset,
  Megaphone,
  // lunch 후보
  Coffee,
  CircleEllipsis,
  CirclePause,
  Utensils,
  // intake_closed 후보
  AlertTriangle,
  ClipboardX,
  CircleAlert,
  OctagonAlert,
  // closed 후보
  CircleSlash,
  DoorClosed,
  Lock,
  PowerOff,
  type LucideIcon,
} from 'lucide-react';

export type BusinessStatusKind = 'open' | 'lunch' | 'intake_closed' | 'closed';

/** lucide 컴포넌트 매핑 — 화이트리스트 (이 외 이름은 거절) */
export const STATE_ICON_MAP: Record<string, LucideIcon> = {
  // open
  Headset,
  CircleDot,
  Activity,
  Megaphone,
  // lunch
  Coffee,
  Utensils,
  CirclePause,
  CircleEllipsis,
  // intake_closed
  CircleAlert,
  AlertTriangle,
  ClipboardX,
  OctagonAlert,
  // closed
  DoorClosed,
  Lock,
  CircleSlash,
  PowerOff,
};

/** 어드민 Select에 노출할 상태별 옵션 (순서대로 추천) */
export const STATE_ICON_OPTIONS: Record<BusinessStatusKind, string[]> = {
  open: ['Headset', 'CircleDot', 'Activity', 'Megaphone'],
  lunch: ['Coffee', 'Utensils', 'CirclePause', 'CircleEllipsis'],
  intake_closed: ['CircleAlert', 'AlertTriangle', 'ClipboardX', 'OctagonAlert'],
  closed: ['DoorClosed', 'Lock', 'CircleSlash', 'PowerOff'],
};

/** DB·시드 기본값. 어드민이 미설정/잘못된 이름 저장 시 폴백. */
export const DEFAULT_STATE_ICONS: Record<BusinessStatusKind, string> = {
  open: 'Headset',
  lunch: 'Coffee',
  intake_closed: 'CircleAlert',
  closed: 'DoorClosed',
};

export type StateIcons = Record<BusinessStatusKind, string>;

/** 상태별 한국어 라벨 — 폼/도움말 안내에서 사용. */
export const STATE_LABEL_KR: Record<BusinessStatusKind, string> = {
  open: '운영 중',
  lunch: '점심시간',
  intake_closed: '접수 마감 (운영 중)',
  closed: '운영 외 (휴무)',
};

/**
 * 이름 → lucide 컴포넌트. 화이트리스트 미존재 시 status별 기본값.
 * @param name 어드민이 저장한 컴포넌트 이름 (예: 'Headset')
 * @param status 폴백 결정용 상태 키
 */
export function resolveStateIcon(
  name: string | null | undefined,
  status: BusinessStatusKind,
): LucideIcon {
  if (name && STATE_ICON_MAP[name]) return STATE_ICON_MAP[name];
  return STATE_ICON_MAP[DEFAULT_STATE_ICONS[status]] ?? Headset;
}

/**
 * jsonb로 저장된 raw 값을 정규화 — 누락된 키는 기본값, 잘못된 값은 기본값으로 치환.
 * `business-hours-default` 시드/upsert 입력 검증용.
 */
export function normalizeStateIcons(raw: unknown): StateIcons {
  const obj =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const out: StateIcons = { ...DEFAULT_STATE_ICONS };
  for (const k of ['open', 'lunch', 'intake_closed', 'closed'] as const) {
    const v = obj[k];
    if (typeof v === 'string' && STATE_ICON_MAP[v]) {
      out[k] = v;
    }
  }
  return out;
}
