import { AdminDetailSkeleton } from '@/components/ui/skeletons';

/** 리스트 → 상세 전환 시 스켈레톤. 데이터 로딩 후 실제 화면으로 교체. */
export default function Loading() {
  return <AdminDetailSkeleton />;
}
