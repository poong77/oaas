/**
 * categories.icon (text 값) → lucide-react 컴포넌트 매핑.
 *
 * 시드 데이터에 사용된 아이콘만 등록. 미등록 아이콘은 HelpCircle로 fallback.
 */

import {
  AlertCircle,
  AlertTriangle,
  Building2,
  Clock,
  Database,
  Flame,
  Globe,
  HelpCircle,
  KeyRound,
  Layers,
  MoreHorizontal,
  Monitor,
  Settings,
  Sparkles,
  Zap,
  type LucideIcon,
} from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  Building2,
  Layers,
  KeyRound,
  Monitor,
  Globe,
  Settings,
  AlertCircle,
  AlertTriangle,
  HelpCircle,
  Sparkles,
  Database,
  MoreHorizontal,
  Flame,
  Zap,
  Clock,
};

export function resolveIcon(name: string | null | undefined): LucideIcon {
  if (!name) return HelpCircle;
  return ICON_MAP[name] ?? HelpCircle;
}
