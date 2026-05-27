import * as React from 'react';
import { requireRole } from '@/lib/permissions';
import { AdminNav } from './_components/admin-nav';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 어드민만 접근 (매니저는 Phase 2~5에서 별도 허용)
  await requireRole(['admin']);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <AdminNav />
      {children}
    </div>
  );
}
