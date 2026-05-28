import * as React from 'react';
import { cookies } from 'next/headers';
import { requireAuth } from '@/lib/permissions';
import { resolveRoleMode } from '@/lib/types/role-mode';
import { VIEW_MODE_COOKIE } from '@/lib/view-mode';
import { UserNav } from './_components/user-nav';

export const dynamic = 'force-dynamic';

export default async function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAuth();

  // 프로필 영역 자체는 사용자의 실제 role에 맞춘 컬러 톤이 자연스럽다.
  // 매니저가 시점 보기 ON 상태에서 /profile 진입 시에도 viewMode 적용.
  const cookieStore = await cookies();
  const viewModeCookie = cookieStore.get(VIEW_MODE_COOKIE)?.value;
  const userMode = resolveRoleMode(user.role, viewModeCookie);

  return (
    <div
      data-role={userMode}
      className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8"
    >
      <UserNav role={user.role} />
      {children}
    </div>
  );
}
