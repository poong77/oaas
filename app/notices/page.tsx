/**
 * /notices — 공지/업데이트 placeholder.
 *
 * Phase 7에서 notices 테이블 + 목록 / 상세 / 핀고정 구현.
 */

import Link from 'next/link';
import { Megaphone } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';

export const metadata = { title: '공지/업데이트 — OA 통합 AS' };

export default function NoticesPage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <PageHeader
        title="공지 / 업데이트"
        description="서비스 변경 사항·점검·장애·릴리즈 노트를 한곳에서 확인하세요."
      />

      <Card>
        <CardContent className="p-6">
          <EmptyState
            icon={<Megaphone className="h-6 w-6" />}
            title="공지 시스템은 Phase 7에서 추가됩니다"
            description="공지·릴리즈·긴급 공지를 카테고리별로 구분하여 노출할 예정입니다. 현재는 서비스 상태 페이지에서 운영 상태를 확인하실 수 있습니다."
            action={
              <Button asChild variant="outline" size="sm">
                <Link href="/status">서비스 상태 페이지</Link>
              </Button>
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
