/**
 * /tickets — 내 문의 목록 placeholder.
 *
 * Phase 6에서 tickets 테이블 + 본인 티켓 조회 구현.
 */

import Link from 'next/link';
import { ListChecks } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';

export const metadata = { title: '내 문의 — OA 통합 AS' };

export default function MyTicketsPlaceholder() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <PageHeader
        title="내 문의"
        description="접수한 문의의 처리 상태와 답변을 확인합니다."
      />

      <Card>
        <CardContent className="p-6">
          <EmptyState
            icon={<ListChecks className="h-6 w-6" />}
            title="내 문의 조회는 Phase 6에서 추가됩니다"
            description="접수된 티켓 목록 · 상태(접수/처리중/완료/보류) · 추가 답변 작성이 이 페이지에 구현될 예정입니다."
            action={
              <Button asChild size="sm">
                <Link href="/tickets/new">신규 문의 접수</Link>
              </Button>
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
