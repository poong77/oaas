/**
 * LP-01 ⑦ 최근 업데이트 위젯 (LP-04).
 *
 * TODO(phase-2-temp): Phase 7에서 notices 테이블 연결.
 * 현재는 EmptyState로 자리만 잡음.
 */

import Link from 'next/link';
import { Megaphone } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';

export function RecentUpdates() {
  return (
    <section
      aria-labelledby="updates-heading"
      className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8"
    >
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <h2
            id="updates-heading"
            className="text-lg font-bold tracking-tight sm:text-xl"
          >
            최근 업데이트 · 공지
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
            서비스 변경 사항과 운영 공지를 확인하세요.
          </p>
        </div>
        <Link
          href="/notices"
          className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
        >
          전체 보기 →
        </Link>
      </div>

      <EmptyState
        icon={<Megaphone className="h-6 w-6" />}
        title="아직 등록된 공지가 없습니다"
        description="공지 / 업데이트 시스템은 Phase 7에서 추가될 예정입니다."
      />
    </section>
  );
}
