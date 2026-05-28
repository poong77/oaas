/**
 * /admin/master/form-fields — 접수 폼 필드 (Phase 9).
 * `ticket_form_fields` 테이블 CRUD. productCode NULL = 전 제품 공통.
 */

import Link from 'next/link';
import { ArrowLeft, Plus, Wrench } from 'lucide-react';

import { requireRole } from '@/lib/permissions';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { listFormFields } from '@/lib/services/master-form-fields';

export const dynamic = 'force-dynamic';
export const metadata = { title: '접수 폼 필드 — 마스터 데이터' };

export default async function MasterFormFieldsPage() {
  await requireRole(['manager', 'admin']);
  const items = await listFormFields({ includeInactive: true });

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="접수 폼 필드"
        description="제품별 동적 접수 폼 필드 정의. productCode = NULL이면 전 제품 공통."
        breadcrumb={
          <Link
            href="/admin/master"
            className="inline-flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <ArrowLeft className="h-3 w-3" /> 마스터 데이터
          </Link>
        }
        actions={
          <Button asChild>
            <Link href="/admin/master/form-fields/new">
              <Plus className="h-4 w-4" /> 신규 필드
            </Link>
          </Button>
        }
      />

      {items.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <EmptyState
              icon={<Wrench className="h-6 w-6" />}
              title="등록된 폼 필드가 없습니다"
              description="제품별 동적 필드를 정의하세요. 빈 상태에서는 티켓 접수 폼이 하드코딩 기본 필드만 노출합니다."
              action={
                <Button asChild size="sm">
                  <Link href="/admin/master/form-fields/new">신규 필드</Link>
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {items.map((f) => (
                <li
                  key={f.id}
                  className={`flex items-center justify-between gap-3 p-4 hover:bg-slate-50 dark:hover:bg-slate-900/40 ${
                    f.isActive ? '' : 'opacity-50'
                  }`}
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={f.productCode ? 'brand' : 'slate'}>
                        {f.productCode ?? '전체 공통'}
                      </Badge>
                      <code className="font-mono text-xs text-slate-700 dark:text-slate-300">
                        {f.fieldKey}
                      </code>
                      <Badge tone="warn">{f.inputType}</Badge>
                      {f.required && <Badge tone="danger">필수</Badge>}
                      {!f.isActive && <Badge tone="danger">비활성</Badge>}
                    </div>
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {f.label}
                    </span>
                    {f.helpText && (
                      <span className="line-clamp-1 text-xs text-slate-500 dark:text-slate-400">
                        {f.helpText}
                      </span>
                    )}
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/admin/master/form-fields/${f.id}`}>편집</Link>
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
