import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getUserById, listHotels } from '@/lib/services/users';
import { requireRole } from '@/lib/permissions';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { UserEditForm } from './_components/user-edit-form';
import { UserActions } from './_components/user-actions';

export const dynamic = 'force-dynamic';

type RouteParams = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: RouteParams }) {
  const { id } = await params;
  return { title: `사용자 ${id.slice(0, 8)} — 어드민` };
}

export default async function AdminUserDetailPage({
  params,
}: {
  params: RouteParams;
}) {
  const me = await requireRole(['admin']);
  const { id } = await params;
  const target = await getUserById(id);
  if (!target) notFound();

  const { items: hotels } = await listHotels({ pageSize: 200, isActive: true });

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={`${target.name} 편집`}
        description={`${target.email} · ${roleLabel(target.role)} · ${target.isActive ? '활성' : '비활성'}`}
        breadcrumb={
          <Link href="/admin/users" className="inline-flex items-center gap-1 hover:underline">
            <ArrowLeft className="h-3 w-3" />사용자 관리
          </Link>
        }
        actions={
          <Button variant="outline" asChild>
            <Link href="/admin/users">목록으로</Link>
          </Button>
        }
      />

      <UserEditForm
        target={{
          id: target.id,
          name: target.name,
          title: target.title,
          phone: target.phone,
          email: target.email ?? '',
          username: target.username,
          role: target.role,
          hotelId: target.hotelId,
          hotelName: target.hotelName,
        }}
        hotels={hotels.map((h) => ({ id: h.id, name: h.name, oaPmsId: h.oaPmsHotelId }))}
      />

      <UserActions
        target={{
          id: target.id,
          name: target.name,
          email: target.email ?? '',
          isActive: target.isActive,
        }}
        meId={me.id}
      />
    </div>
  );
}

function roleLabel(r: 'hotelier' | 'manager' | 'admin') {
  return r === 'admin' ? '어드민' : r === 'manager' ? '매니저' : '호텔리어';
}
