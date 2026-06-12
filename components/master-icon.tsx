/**
 * 마스터 데이터(제품분류·역할별 등)에 등록된 아이콘을 렌더링하는 공용 컴포넌트.
 *
 * 우선순위:
 *   1. iconImageUrl — 어드민에서 업로드한 아이콘 이미지(공개 프록시 URL)
 *   2. iconName     — lucide-react 아이콘명 (icon-resolver의 44종 화이트리스트)
 *   3. fallback     — 정적 폴백 LucideIcon (없으면 HelpCircle)
 *
 * @see components/icon-resolver.tsx — 어드민 등록 가능한 아이콘 화이트리스트와 동일 소스
 */

import type { LucideIcon } from 'lucide-react';
import { resolveIcon } from '@/components/icon-resolver';

export function MasterIcon({
  iconName,
  iconImageUrl,
  fallback: Fallback,
  className,
}: {
  iconName?: string | null;
  iconImageUrl?: string | null;
  fallback?: LucideIcon;
  className?: string;
}) {
  if (iconImageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={iconImageUrl}
        alt=""
        aria-hidden
        className={`${className ?? ''} object-contain`.trim()}
      />
    );
  }

  const Icon = iconName ? resolveIcon(iconName) : (Fallback ?? resolveIcon(null));
  return <Icon className={className} />;
}
