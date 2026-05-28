/**
 * /tickets/new — 이슈 접수 폼 placeholder.
 *
 * Phase 5에서 ticket_form_fields + 3단계 폼 + 첨부 + Slack 알림 구현.
 */

import Link from 'next/link';
import { FilePlus2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';

export const metadata = { title: '문의 접수 — OA 통합 AS' };

type SearchParams = Promise<{ type?: string; product?: string }>;

export default async function NewTicketPlaceholder({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { type, product } = await searchParams;

  const heading = type === 'error' ? '오류 접수' : '문의 접수';
  const description =
    type === 'error'
      ? '발생한 오류·장애를 빠르게 접수합니다.'
      : '오류 · 기능문의 · 기능개발 · 데이터수정 등 모든 유형의 문의를 접수합니다.';

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <PageHeader title={heading} description={description} />

      <Card>
        <CardContent className="p-6">
          <EmptyState
            icon={<FilePlus2 className="h-6 w-6" />}
            title="이슈 접수 폼은 Phase 5에서 추가됩니다"
            description={[
              `제품${product ? ` (${product})` : ''}, 유형, 영향범위, 제목, 내용, 첨부파일을 입력하는`,
              '3단계 접수폼이 구현될 예정입니다. 접수 시 SMS/이메일 자동 발송 + Slack #as-new 알림이 함께 동작합니다.',
            ].join(' ')}
            action={
              <div className="flex gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link href="/help">제품별 가이드</Link>
                </Button>
                <Button asChild size="sm">
                  <Link href="/tickets">내 문의 보기</Link>
                </Button>
              </div>
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
