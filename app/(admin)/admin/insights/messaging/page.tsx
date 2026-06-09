/**
 * `/admin/insights/messaging` — 메일&문자 발송 (툴 박스, major-overhaul P7).
 *
 * 매니저+어드민. 탭 3개(메일/문자/메시지함). 발송 이력은 notification_logs(batch 단위) + activity_logs.
 */

import { PageHeader } from '@/components/ui/page-header';
import { requireRole } from '@/lib/permissions';
import { env } from '@/lib/env';
import { MessagingClient } from './_components/messaging-client';

export const dynamic = 'force-dynamic';
export const metadata = { title: '메일&문자 — OA 통합 AS' };

export default async function MessagingPage() {
  await requireRole(['manager', 'admin']);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="메일&문자"
        description="호텔·호텔리어에게 메일(SES) 또는 문자(Solapi)를 직접 발송합니다. 발송 이력이 기록됩니다."
      />
      <MessagingClient
        senderEmailLocal="as"
        senderPhone={env.SOLAPI_SENDER || '(발신번호 미설정)'}
      />
    </div>
  );
}
