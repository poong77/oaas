/**
 * 개인정보 처리방침 (/privacy) — 공개 페이지.
 *
 * 정식 처리방침은 법무·DPO 검토 후 공개 예정. 현재는 정중한 안내 placeholder.
 */

import Link from 'next/link';
import { ShieldCheck, Mail } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';

export const metadata = {
  title: '개인정보 처리방침 — OA서포트',
  description: 'OA서포트 개인정보 처리방침 안내.',
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        breadcrumb={
          <Link href="/" className="hover:underline">
            홈
          </Link>
        }
        title="개인정보 처리방침"
        description="OA서포트이 수집·이용하는 개인정보에 대한 안내입니다."
      />

      <Card>
        <CardContent className="space-y-6 p-6 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
          <section className="space-y-2">
            <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <ShieldCheck className="h-4 w-4 text-brand-600" />
              <h2 className="text-base font-semibold">처리 원칙</h2>
            </div>
            <p>
              본 플랫폼은 호텔리어 고객의 AS 티켓 처리와 셀프 서비스 제공을 위해
              최소한의 개인정보만을 수집·이용하며, 「개인정보 보호법」 및 관련
              법령을 준수합니다.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              안내
            </h2>
            <p>
              정식 개인정보 처리방침은 현재 준비 중이며, 법무·DPO 검토 완료 후 본
              페이지에 공개됩니다. 공개 전까지 본 플랫폼에서 처리되는 개인정보는{' '}
              <a
                href="https://oapms.com"
                target="_blank"
                rel="noreferrer noopener"
                className="text-brand-700 hover:underline dark:text-brand-300"
              >
                oapms.com
              </a>
              의 개인정보 처리방침에 준하여 보호됩니다.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              수집·이용 항목 (예정)
            </h2>
            <ul className="ml-4 list-disc space-y-1 text-slate-600 dark:text-slate-300">
              <li>로그인 식별 정보 (이메일, 호텔 소속, 권한)</li>
              <li>티켓 접수 시 입력한 연락처 (이메일, 휴대전화)</li>
              <li>서비스 이용 로그 (접속 일시, IP 등 보안 목적)</li>
            </ul>
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
              <h2 className="text-sm font-semibold">개인정보 관련 문의</h2>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              개인정보 열람·정정·삭제 요청은 운영팀으로 접수해 주세요.{' '}
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
