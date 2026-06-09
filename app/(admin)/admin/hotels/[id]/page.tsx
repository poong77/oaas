import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowUpRight, Users } from 'lucide-react';

import { requireRole } from '@/lib/permissions';
import { getHotelById } from '@/lib/services/users';
import {
  listHotelSlackChannels,
  listHotelSolutions,
  listManagedHotels,
  listMappedUsers,
  listSolutionPresets,
} from '@/lib/services/hotels';
import { PageHeader } from '@/components/ui/page-header';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { HotelProfileForm } from './_components/hotel-profile-form';
import { HotelSolutions } from './_components/hotel-solutions';
import { HotelManaged } from './_components/hotel-managed';
import { HotelSlackChannels } from './_components/hotel-slack-channels';

export const dynamic = 'force-dynamic';

const ROLE_LABEL: Record<string, string> = {
  hotelier: '호텔리어',
  manager: '매니저',
  admin: '어드민',
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const hotel = await getHotelById(id);
  return { title: `${hotel?.name ?? '호텔'} — 호텔 상세` };
}

export default async function HotelDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(['admin']);
  const { id } = await params;
  const hotel = await getHotelById(id);
  if (!hotel) notFound();

  const [solutions, presets, managed, mappedUsers, slackChannels] =
    await Promise.all([
      listHotelSolutions(id),
      listSolutionPresets(),
      listManagedHotels(id),
      listMappedUsers(id),
      listHotelSlackChannels(id),
    ]);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link
          href="/admin/hotels"
          className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-200"
        >
          <ArrowLeft className="h-4 w-4" />호텔 마스터로
        </Link>
        <PageHeader
          title={
            <span className="flex items-center gap-2">
              {hotel.name}
              {!hotel.isActive && <Badge tone="slate">비활성</Badge>}
            </span>
          }
          description={
            hotel.oaPmsHotelId
              ? `OA PMS ID: ${hotel.oaPmsHotelId}`
              : 'OA PMS 매핑 없음 (직접 등록)'
          }
        />
      </div>

      {/* 기본 정보 (사업자 · 연락처 · 메모) */}
      <HotelProfileForm hotel={hotel} />

      {/* 이용중 솔루션 */}
      <HotelSolutions hotelId={id} solutions={solutions} presets={presets} />

      {/* 슬랙 채널 연동 (N:N — 접수 알림 병행) */}
      <HotelSlackChannels hotelId={id} channels={slackChannels} />

      {/* 매핑된 이용자 계정 (읽기 전용) */}
      <Card>
        <CardHeader>
          <CardTitle>매핑된 이용자 계정</CardTitle>
          <CardDescription>
            이 호텔에 소속된 이용자 계정입니다. 계정 편집은 사용자 관리에서 진행합니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {mappedUsers.length === 0 ? (
            <p className="flex items-center gap-2 py-2 text-sm text-slate-400">
              <Users className="h-4 w-4" />매핑된 이용자 계정이 없습니다.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
              {mappedUsers.map((u) => (
                <li key={u.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm">
                  <span className="font-medium">{u.name}</span>
                  <span className="text-slate-500">{u.username ?? u.email}</span>
                  <Badge tone={u.role === 'admin' ? 'brand' : 'slate'}>
                    {ROLE_LABEL[u.role] ?? u.role}
                  </Badge>
                  {!u.isActive && <Badge tone="slate">비활성</Badge>}
                  <Link
                    href={`/admin/users/${u.id}`}
                    className="ml-auto inline-flex items-center gap-1 text-brand-600 hover:underline dark:text-brand-400"
                  >
                    바로가기 <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* 멀티관리 호텔 */}
      <HotelManaged hotelId={id} managed={managed} />
    </div>
  );
}
