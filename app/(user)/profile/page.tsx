import { AlertCircle } from 'lucide-react';
import { requireAuth } from '@/lib/permissions';
import {
  getHotelById,
  getUserById,
  listSolutionLinksByHotel,
} from '@/lib/services/users';
import { PageHeader } from '@/components/ui/page-header';
import { ProfileForm } from './_components/profile-form';
import { ChangePasswordForm } from './_components/change-password-form';
import { SolutionLinks } from './_components/solution-links';

export const dynamic = 'force-dynamic';
export const metadata = { title: '내 프로필 — OA 통합 AS' };

export default async function ProfilePage() {
  const user = await requireAuth('/profile');
  const dbUser = await getUserById(user.id);
  const hotel = user.hotelId ? await getHotelById(user.hotelId) : null;
  const solutionLinks = user.hotelId
    ? await listSolutionLinksByHotel(user.hotelId)
    : [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="내 프로필"
        description="개인 정보와 호텔 정보, 솔루션 링크, 비밀번호를 관리합니다."
      />

      {user.mustChangePassword && (
        <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div className="flex flex-col gap-1">
            <strong>기본 비밀번호(123456) 사용 중 — 정보 업데이트가 필요합니다</strong>
            <span>
              보안을 위해 아래 <strong>‘비밀번호 변경’</strong>에서 비밀번호를 꼭
              변경하고, <strong>연락처·이메일 주소</strong>와 기타 정보를 정확히
              입력해주세요. 비밀번호 분실·중요 안내 수신을 위해 꼭 필요합니다.
            </span>
          </div>
        </div>
      )}

      <ProfileForm
        initial={{
          name: dbUser?.name ?? user.name ?? '',
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

      <ChangePasswordForm />
    </div>
  );
}
