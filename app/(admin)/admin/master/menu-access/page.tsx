/**
 * /admin/master/menu-access — 메뉴 접근 제어 (어드민 only).
 *
 * 마스터 하위 개별 메뉴별로 매니저 접근 허용/차단을 ON/OFF 스위치로 결정.
 * 어드민은 항상 전체 접근. 고정 어드민 전용 메뉴는 토글 대상에서 제외.
 *
 * 저장: system_settings(master_menu_manager_access). 강제: 각 메뉴 폴더 layout 가드.
 */

import Link from 'next/link';
import { ArrowLeft, ShieldCheck, Lock } from 'lucide-react';

import { requireRole } from '@/lib/permissions';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  MASTER_MENUS,
  TOGGLEABLE_MASTER_MENUS,
} from '@/lib/services/master-meta';
import { getManagerAccessMap } from '@/lib/services/master-menu-access';
import { MenuAccessList } from './_components/menu-access-list';

export const dynamic = 'force-dynamic';
export const metadata = { title: '메뉴 접근 제어 — 마스터DB' };

export default async function MasterMenuAccessPage() {
  await requireRole(['admin']);
  const accessMap = await getManagerAccessMap();
  const allowedCount = TOGGLEABLE_MASTER_MENUS.filter(
    (m) => accessMap[m.key] === true,
  ).length;
  const lockedMenus = MASTER_MENUS.filter((m) => m.hardAdminOnly);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="메뉴 접근 제어"
        description={`마스터 개별 메뉴의 매니저 접근을 결정합니다. 토글 ${TOGGLEABLE_MASTER_MENUS.length}개 중 ${allowedCount}개 허용. 어드민은 항상 전체 접근합니다.`}
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
        <CardContent className="flex items-start gap-3 p-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-300">
            <ShieldCheck className="h-4 w-4" />
          </span>
          <div className="flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-300">
            <strong className="text-slate-900 dark:text-slate-100">
              이 메뉴는 어드민 전용입니다
            </strong>
            <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              스위치를 끄면 해당 메뉴는 매니저에게 사이드/마스터 카드에서 숨겨지고,
              URL로 직접 진입해도 접근할 수 없습니다(404). 변경은 즉시 반영되며
              모든 토글은 <span className="font-mono">activity_logs</span>에
              기록됩니다.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <MenuAccessList
            menus={TOGGLEABLE_MASTER_MENUS}
            initialAccess={accessMap}
          />
        </CardContent>
      </Card>

      {/* 고정 어드민 전용 (참고용, 토글 불가) */}
      <Card>
        <CardContent className="flex flex-col gap-2 p-4">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <Lock className="h-3.5 w-3.5" /> 영구 어드민 전용 (토글 불가)
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            아래 메뉴는 항상 어드민만 접근하며 매니저 접근으로 전환할 수 없습니다.
            그 외 모든 마스터DB 메뉴는 위에서 매니저 접근을 켜고 끌 수 있습니다.
          </p>
          <div className="mt-1 flex flex-wrap gap-2">
            {lockedMenus.map((m) => (
              <Badge key={m.key} tone="slate">
                {m.label}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
