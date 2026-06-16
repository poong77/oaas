import * as React from 'react';
import { requireAuth } from '@/lib/permissions';
import { resolveRoleMode } from '@/lib/types/role-mode';

export const dynamic = 'force-dynamic';

export default async function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAuth();
  const userMode = resolveRoleMode(user.role);

  // 보조 내비(UserNav)는 프로필 탭·전역 헤더와 중복이라 제거(2026-06-10).
  return (
    <div data-role={userMode} className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6">
        {children}
      </div>
    </div>
  );
}
