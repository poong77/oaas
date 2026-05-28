/**
 * /faq — 빠른 해결 (FAQ) placeholder.
 *
 * Phase 4에서 faqs + checklists 테이블 + 아코디언 UI 구현.
 */

import Link from 'next/link';
import { Lightbulb } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';

export const metadata = { title: '빠른 해결 — OA 통합 AS' };

export default function FaqPlaceholderPage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <PageHeader
        title="빠른 해결"
        description="FAQ와 트러블슈팅 체크리스트로 자가 해결을 도와드립니다."
      />

      <Card>
        <CardContent className="p-6">
          <EmptyState
            icon={<Lightbulb className="h-6 w-6" />}
            title="FAQ는 Phase 4에서 추가됩니다"
            description="자주 묻는 질문과 단계별 체크리스트가 추가될 예정입니다. 그동안은 제품별 가이드를 이용하거나 문의를 접수해주세요."
            action={
              <div className="flex gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link href="/help">제품별 가이드</Link>
                </Button>
                <Button asChild size="sm">
                  <Link href="/tickets/new">문의 접수</Link>
                </Button>
              </div>
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
