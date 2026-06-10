/**
 * /profile — 마이페이지 (시안 탭 레이아웃 적용, 2026-06-10).
 *
 * 좌측 탭: 내 정보 / 비밀번호 변경 / 직원 관리. 실제 폼·실데이터 그대로.
 */
import { AlertCircle } from 'lucide-react';
import { requireAuth } from '@/lib/permissions';
import {
  getHotelById,
  getUserById,
  listSolutionLinksByHotel,
  listStaffByHotel,
} from '@/lib/services/users';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Users } from 'lucide-react';
import { ProfileForm } from './_components/profile-form';
import { ChangePasswordForm } from './_components/change-password-form';
import { SolutionLinks } from './_components/solution-links';
import { ProfileTabsShell } from './_components/profile-tabs-shell';
import { StaffManager } from './staff/_components/staff-manager';

export const dynamic = 'force-dynamic';
export const metadata = { title: '마이페이지 — OA서포트' };

export default async function ProfilePage() {
  const user = await requireAuth('/profile');
  const dbUser = await getUserById(user.id);
  const hotel = user.hotelId ? await getHotelById(user.hotelId) : null;
  const [solutionLinks, staff] = await Promise.all([
    user.hotelId ? listSolutionLinksByHotel(user.hotelId) : Promise.resolve([]),
    user.hotelId ? listStaffByHotel(user.hotelId) : Promise.resolve([]),
  ]);

  const staffNode = !user.hotelId ? (
    <Card>
      <CardContent className="pt-6">
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title="직원 관리를 사용할 수 없습니다"
          description="호텔이 매핑되지 않은 계정은 직원 관리 기능을 사용할 수 없습니다."
        />
      </CardContent>
    </Card>
  ) : (
    <StaffManager initialStaff={staff} myUserId={user.id} />
  );

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight sm:text-[28px]">
        마이페이지
      </h1>

      {user.mustChangePassword && (
        <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div className="flex flex-col gap-1">
            <strong>기본 비밀번호(123456) 사용 중 — 정보 업데이트가 필요합니다</strong>
            <span>
              보안을 위해 <strong>‘비밀번호 변경’</strong> 탭에서 비밀번호를 꼭
              변경하고, <strong>연락처·이메일 주소</strong>와 기타 정보를 정확히
              입력해주세요.
            </span>
          </div>
        </div>
      )}

      <ProfileTabsShell
        user={{
          name: dbUser?.name ?? user.name ?? '',
          email: dbUser?.email ?? user.email ?? '',
          phone: dbUser?.phone ?? '',
          hotelName: hotel?.name ?? '',
          title: dbUser?.title ?? '',
        }}
        profile={
          <>
            <ProfileForm
              initial={{
                name: dbUser?.name ?? user.name ?? '',
                loginId: dbUser?.username ?? '',
                title: dbUser?.title ?? '',
                phone: dbUser?.phone ?? '',
                email: dbUser?.email ?? user.email ?? '',
                hotelName: hotel?.name ?? '',
                hotelPhone: hotel?.phone ?? '',
                hotelAddress: hotel?.address ?? '',
                hasHotel: !!hotel,
              }}
            />
            <SolutionLinks links={solutionLinks} hasHotel={!!user.hotelId} />
          </>
        }
        password={<ChangePasswordForm />}
        staff={staffNode}
      />
    </div>
  );
}
