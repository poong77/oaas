/**
 * /admin/master/system-settings — 시스템 설정 (Phase 9).
 * 어드민 only. key-value 일괄 리스트 + 인라인 폼.
 */

import Link from 'next/link';
import { ArrowLeft, Settings } from 'lucide-react';

import { requireRole } from '@/lib/permissions';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import {
  listSystemSettings,
  KNOWN_SETTING_KEYS,
} from '@/lib/services/master-system-settings';
import { SystemSettingsEditor } from './_components/system-settings-editor';

export const dynamic = 'force-dynamic';
export const metadata = { title: '시스템 설정 — 마스터DB' };

export default async function MasterSystemSettingsPage() {
  await requireRole(['admin']);
  const items = await listSystemSettings(true);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="시스템 설정"
        description="어드민 only. key-value 설정. value는 JSON 또는 string."
        breadcrumb={
          <Link
            href="/admin/master"
            className="inline-flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <ArrowLeft className="h-3 w-3" /> 마스터DB
          </Link>
        }
      />

      <Card>
        <CardContent className="flex flex-col gap-1 p-4">
          <div className="text-sm font-semibold">알려진 설정 키</div>
          <div className="flex flex-wrap gap-2 text-xs">
            {KNOWN_SETTING_KEYS.map((k) => (
              <Badge key={k} tone="slate" className="font-mono">
                {k}
              </Badge>
            ))}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            value는 JSON으로 파싱 시도. 실패 시 원본 문자열로 저장됩니다.
          </p>
        </CardContent>
      </Card>

      {/* 기존 row 리스트 + 인라인 편집 */}
      {items.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <EmptyState
              icon={<Settings className="h-6 w-6" />}
              title="등록된 설정이 없습니다"
              description="아래 폼에서 신규 설정을 추가하세요."
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <SystemSettingsEditor items={items} />
          </CardContent>
        </Card>
      )}

      {/* 신규 추가 */}
      <Card>
        <CardContent className="p-4">
          <h3 className="mb-3 text-sm font-semibold">신규 / 기존 키 업서트</h3>
          <SystemSettingsEditor items={[]} createOnly />
        </CardContent>
      </Card>
    </div>
  );
}
