import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * PageContainer — 프론트(호텔리어) 페이지의 표준 콘텐츠 컨테이너.
 *
 * 좌우 패딩은 바깥 전체폭 래퍼에, max-w-[1200px]는 안쪽에 두어
 * 콘텐츠가 정확히 1200px(좌우 패딩 바깥)로 정렬되도록 한다.
 * 푸터(ContactPanel)·홈 섹션과 동일한 정렬 기준을 공유한다.
 *
 * @param className      바깥 래퍼 추가 클래스 (주로 세로 패딩 py-*)
 * @param innerClassName 안쪽 max-w 래퍼 추가 클래스 (flex/gap 등 레이아웃)
 */
export function PageContainer({
  className,
  innerClassName,
  children,
}: {
  className?: string;
  innerClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('px-4 sm:px-6 lg:px-8', className)}>
      <div className={cn('mx-auto w-full max-w-[1200px]', innerClassName)}>
        {children}
      </div>
    </div>
  );
}
