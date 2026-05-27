import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { listHotels } from '@/lib/services/users';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { UserCreateForm } from './_components/user-create-form';

export const dynamic = 'force-dynamic';
export const metadata = { title: '사용자 추가 — OA 통합 AS 어드민' };

export default async function NewUserPage() {
  const { items: hotels } = await listHotels({ pageSize: 100, isActive: true });

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="사용자 추가"
        description="호텔 매핑·권한을 설정하여 새 계정을 생성합니다. 임시 비밀번호가 SMS와 이메일로 발송됩니다."
        breadcrumb={
          <Link href="/admin/users" className="inline-flex items-center gap-1 hover:underline">
            <ArrowLeft className="h-3 w-3" />사용자 관리
          </Link>
        }
        actions={
          <Button variant="outline" asChild>
            <Link href="/admin/users">취소</Link>
          </Button>
        }
      />
      <UserCreateForm
        hotels={hotels.map((h) => ({ id: h.id, name: h.name, oaPmsId: h.oaPmsHotelId }))}
      />
    </div>
  );
}
