import { PageShellSkeleton } from '@/components/ui/skeletons';

/** 전역 기본 로딩 — 라우트 전환 시 헤더 + 카드 리스트 자리를 즉시 표시. */
export default function Loading() {
  return <PageShellSkeleton cards={4} />;
}
