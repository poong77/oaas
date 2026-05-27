import { Users } from 'lucide-react';
import { requireAuth } from '@/lib/permissions';
import { listStaffByHotel } from '@/lib/services/users';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { StaffManager } from './_components/staff-manager';

export const dynamic = 'force-dynamic';
export const metadata = { title: '직원 관리 — OA 통합 AS' };

export default async function StaffPage() {
  const user = await requireAuth('/profile/staff');

  if (!user.hotelId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>직원 관리</CardTitle>
          <CardDescription>호텔이 매핑되지 않은 계정은 직원 관리 기능을 사용할 수 없습니다.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const staff = await listStaffByHotel(user.hotelId);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="직원 관리"
        description="본인 호텔의 직원 계정을 추가·편집·비활성화합니다. 초대 시 SMS와 이메일이 자동 발송됩니다."
      />

      {staff.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <EmptyState
              icon={<Users className="h-6 w-6" />}
              title="등록된 직원이 없습니다"
              description="아래에서 첫 직원을 추가해보세요."
            />
            <div className="mt-4">
              <StaffManager initialStaff={[]} myUserId={user.id} />
            </div>
          </CardContent>
        </Card>
      ) : (
        <StaffManager initialStaff={staff} myUserId={user.id} />
      )}
    </div>
  );
}
