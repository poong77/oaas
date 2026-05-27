import * as React from 'react';
import { requireAuth } from '@/lib/permissions';
import { UserNav } from './_components/user-nav';

export const dynamic = 'force-dynamic';

export default async function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAuth();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <UserNav role={user.role} />
      {children}
    </div>
  );
}
