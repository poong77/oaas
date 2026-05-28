import * as React from 'react';
import { cookies } from 'next/headers';
import { requireRole } from '@/lib/permissions';
import { resolveRoleMode } from '@/lib/types/role-mode';
import { VIEW_MODE_COOKIE } from '@/lib/view-mode';
import { AdminNav } from './_components/admin-nav';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 매니저+어드민 진입 허용. 메뉴별 추가 권한은 각 page에서 별도 체크.
  const user = await requireRole(['manager', 'admin']);

  // RoleScope가 이미 data-role을 부여하지만, /admin 영역은 viewMode 쿠키 영향 받아도
  // 본인의 실제 role을 우선해야 자물쇠 메뉴 등이 정상 동작. 명시적으로 본인 role로 덮어쓴다.
  const cookieStore = await cookies();
  const viewModeCookie = cookieStore.get(VIEW_MODE_COOKIE)?.value;
  const adminMode = resolveRoleMode(user.role, viewModeCookie);

  return (
    <div
      data-role={adminMode}
      className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8"
    >
      <AdminNav role={user.role} />
      {children}
    </div>
  );
}
