/**
 * 이용약관 (/terms) — 공개 페이지.
 *
 * 정식 약관은 법무 검토 후 공개 예정. 현재는 정중한 안내 placeholder를 노출한다.
 * (운영 정책상 실제 약관 본문은 법무팀 승인 후 별도 마스터로 분리하여 관리)
 */

import Link from 'next/link';
import { FileText, Mail } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';

export const metadata = {
  title: '이용약관 — OA 통합 AS',
  description: 'OA 통합 AS 플랫폼 이용약관 안내.',
};

export default function TermsPage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        breadcrumb={
          <Link href="/" className="hover:underline">
            홈
          </Link>
        }
        title="이용약관"
        description="OA 통합 AS 플랫폼(support.oapms.com) 서비스 이용에 관한 약관입니다."
      />

      <Card>
        <CardContent className="space-y-6 p-6 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
          <section className="space-y-2">
            <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <FileText className="h-4 w-4 text-brand-600" />
              <h2 className="text-base font-semibold">서비스 개요</h2>
            </div>
            <p>
              본 플랫폼은 OA Solutions가 제공하는 PMS · CMS · Keyless · 키오스크 ·
              웹서비스를 이용하는 호텔리어 고객을 위한 통합 셀프 서비스 및 AS
              티켓 허브입니다.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              안내
            </h2>
            <p>
              정식 이용약관은 현재 준비 중이며, 법무 검토 완료 후 본 페이지에
              공개됩니다. 약관이 공개되기 전까지 본 플랫폼의 이용은 OA Solutions
              본사와 체결한 솔루션 공급 계약 및{' '}
              <a
                href="https://oapms.com"
                target="_blank"
                rel="noreferrer noopener"
                className="text-brand-700 hover:underline dark:text-brand-300"
              >
                oapms.com
              </a>
              의 표준 약관을 따릅니다.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              개정 이력
            </h2>
            <ul className="ml-4 list-disc space-y-1 text-slate-600 dark:text-slate-300">
              <li>최초 공개 예정: 추후 공지</li>
            </ul>
          </section>

          <section className="space-y-2 rounded-lg bg-slate-50 p-4 dark:bg-slate-900/50">
            <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <Mail className="h-4 w-4 text-brand-600" />
              <h2 className="text-sm font-semibold">문의</h2>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              약관 관련 문의는 OA Solutions 운영팀으로 접수해 주세요.{' '}
              <Link
                href="/tickets/new"
                className="text-brand-700 hover:underline dark:text-brand-300"
              >
                이슈 접수하기
              </Link>
            </p>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}
