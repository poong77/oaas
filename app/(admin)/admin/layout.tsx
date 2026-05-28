import * as React from 'react';
import { requireRole } from '@/lib/permissions';
import { AdminNav } from './_components/admin-nav';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 매니저+어드민 진입 허용. 메뉴별 추가 권한은 각 page에서 별도 체크.
  const user = await requireRole(['manager', 'admin']);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <AdminNav role={user.role} />
      {children}
    </div>
  );
}
