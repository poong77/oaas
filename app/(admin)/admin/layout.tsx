import * as React from 'react';
import { requireRole } from '@/lib/permissions';
import { resolveRoleMode } from '@/lib/types/role-mode';
import { AdminShell } from './_components/admin-shell';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 매니저+어드민 진입 허용. 메뉴별 추가 권한은 각 page에서 별도 체크.
  const user = await requireRole(['manager', 'admin']);
  const adminMode = resolveRoleMode(user.role);

  return (
    <div data-role={adminMode} className="min-h-screen">
      <AdminShell userRole={user.role}>{children}</AdminShell>
    </div>
  );
}
