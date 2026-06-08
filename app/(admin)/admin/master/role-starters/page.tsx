/**
 * /admin/master/role-starters — 역할별 시작 (Phase 9).
 * 홈 LP-01 ⑤. role_key unique. upsert.
 */

import Link from 'next/link';
import { ArrowLeft, ListChecks } from 'lucide-react';

import { requireRole } from '@/lib/permissions';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import {
  listRoleStarters,
  KNOWN_ROLE_KEYS,
} from '@/lib/services/master-role-starters';
import { resolveIcon } from '@/components/icon-resolver';
import { RoleStarterUpsert } from './_components/role-starter-upsert';

export const dynamic = 'force-dynamic';
export const metadata = { title: '역할별 시작 — 마스터DB' };

export default async function MasterRoleStartersPage() {
  await requireRole(['manager', 'admin']);
  const items = await listRoleStarters(true);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="역할별 시작"
        description="홈 ⑤ 카드. role_key unique. 동일 키 입력 시 자동 업서트됩니다."
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
          <div className="text-sm font-semibold">알려진 role_key</div>
          <div className="flex flex-wrap gap-2 text-xs">
            {KNOWN_ROLE_KEYS.map((k) => (
              <code
                key={k}
                className="rounded bg-slate-100 px-2 py-1 font-mono text-[11px] text-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                {k}
              </code>
            ))}
          </div>
        </CardContent>
      </Card>

      {items.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <EmptyState
              icon={<ListChecks className="h-6 w-6" />}
              title="등록된 항목이 없습니다"
              description="아래 폼에서 5종 역할 카드를 추가하세요. 등록되지 않으면 홈은 _constants.ts의 하드코딩 fallback을 사용합니다."
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {items.map((r) => {
                const Icon = resolveIcon(r.icon);
                return (
                  <li
                    key={r.id}
                    className={`flex items-center justify-between gap-3 p-4 hover:bg-slate-50 dark:hover:bg-slate-900/40 ${
                      r.isActive ? '' : 'opacity-50'
                    }`}
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-300">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone="brand" className="font-mono">
                            {r.roleKey}
                          </Badge>
                          <span className="text-sm font-semibold">
                            {r.label}
                          </span>
                          {!r.isActive && <Badge tone="danger">비활성</Badge>}
                        </div>
                        {r.description && (
                          <span className="line-clamp-1 text-xs text-slate-500 dark:text-slate-400">
                            {r.description}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/admin/master/role-starters/${r.id}`}>
                        편집
                      </Link>
                    </Button>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* 신규/업서트 */}
      <Card>
        <CardContent className="p-4">
          <h3 className="mb-3 text-sm font-semibold">신규 / 업서트</h3>
          <RoleStarterUpsert />
        </CardContent>
      </Card>
    </div>
  );
}
