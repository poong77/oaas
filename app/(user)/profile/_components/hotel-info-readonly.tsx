/**
 * 호텔 정보 조회 전용 카드 (2026-06-11).
 *
 * 호텔 정보는 이용자가 수정할 수 없다(어드민 전용). 여기서는 읽기만 제공한다.
 */
import { Building2 } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';

export type HotelInfoView = {
  name: string | null;
  representativeName: string | null;
  businessNo: string | null;
  phone: string | null;
  address: string | null;
};

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-3 border-b border-dashed border-slate-100 py-2.5 text-sm last:border-b-0 dark:border-slate-800">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className="break-words text-slate-900 dark:text-slate-100">
        {value?.trim() ? value : <span className="text-slate-400">—</span>}
      </span>
    </div>
  );
}

export function HotelInfoReadonly({
  hotel,
}: {
  hotel: HotelInfoView | null;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>호텔 정보</CardTitle>
        <CardDescription>
          조회 전용입니다. 호텔 정보 수정은 OA 운영팀에 요청해주세요.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {hotel ? (
          <div className="flex flex-col">
            <Row label="호텔명" value={hotel.name} />
            <Row label="대표자" value={hotel.representativeName} />
            <Row label="사업자번호" value={hotel.businessNo} />
            <Row label="전화" value={hotel.phone} />
            <Row label="주소" value={hotel.address} />
          </div>
        ) : (
          <EmptyState
            icon={<Building2 className="h-6 w-6" />}
            title="연결된 호텔이 없습니다"
            description="호텔이 매핑되지 않은 계정입니다."
          />
        )}
      </CardContent>
    </Card>
  );
}
