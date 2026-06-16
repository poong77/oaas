'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * BackLink — 브라우저 뒤로 가기 버튼.
 *
 * 이전 페이지로 돌아간다(예: 역할별 추천 가이드 → 아티클 → 뒤로 가면 역할 페이지).
 * 히스토리가 없는 직접 진입(새 탭/북마크/외부 유입) 시에는 fallbackHref로 이동해
 * "갈 곳 없는 뒤로 가기"를 방지한다.
 */
export function BackLink({
  fallbackHref,
  className,
  children,
}: {
  fallbackHref: string;
  className?: string;
  children: ReactNode;
}) {
  const router = useRouter();

  function handleClick() {
    // 같은 오리진에서 넘어온 히스토리가 있으면 뒤로, 아니면 폴백 경로로.
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  }

  return (
    <button type="button" onClick={handleClick} className={className}>
      <ArrowLeft className="h-3 w-3" />
      {children}
    </button>
  );
}
