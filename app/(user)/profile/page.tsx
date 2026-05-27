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
          <div>
            <strong>임시 비밀번호 사용 중</strong> — 보안을 위해 아래
            &lsquo;비밀번호 변경&rsquo; 섹션에서 즉시 비밀번호를 변경해주세요.
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
