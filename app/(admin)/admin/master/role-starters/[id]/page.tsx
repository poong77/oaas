import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { requireRole } from '@/lib/permissions';
import { getRoleStarterById } from '@/lib/services/master-role-starters';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { RoleStarterUpsert } from '../_components/role-starter-upsert';

export const dynamic = 'force-dynamic';
export const metadata = { title: '역할 편집 — 마스터 데이터' };

type Params = Promise<{ id: string }>;

export default async function RoleStarterEditPage({
  params,
}: {
  params: Params;
}) {
  await requireRole(['manager', 'admin']);
  const { id } = await params;
  const item = await getRoleStarterById(id);
  if (!item) notFound();
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={`역할 편집 — ${item.label}`}
        breadcrumb={
          <Link
            href="/admin/master/role-starters"
            className="inline-flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <ArrowLeft className="h-3 w-3" /> 역할별 시작
          </Link>
        }
      />
      <Card>
        <CardContent className="p-4">
          <RoleStarterUpsert item={item} />
        </CardContent>
      </Card>
    </div>
  );
}
