/**
 * /admin/master/hotelier-templates — 호텔리어 접수 템플릿.
 *
 * 호텔리어 접수폼 「자세한 내용」 위 버튼으로 본문에 끼워넣는 정형 입력 양식.
 */

import Link from 'next/link';
import { ArrowLeft, FileText, Plus } from 'lucide-react';

import { requireRole } from '@/lib/permissions';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { listHotelierTemplates } from '@/lib/services/master-hotelier-templates';

export const dynamic = 'force-dynamic';
export const metadata = { title: '호텔리어 템플릿 — 마스터DB' };

export default async function MasterHotelierTemplatesPage() {
  await requireRole(['manager', 'admin']);
  const items = await listHotelierTemplates(true);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="호텔리어 접수 템플릿"
        description="호텔리어 접수폼 「자세한 내용」 위 버튼으로 본문에 끼워넣는 정형 입력 양식. 버튼 라벨·내용·정렬을 편집할 수 있습니다."
        breadcrumb={
          <Link
            href="/admin/master"
            className="inline-flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <ArrowLeft className="h-3 w-3" /> 마스터DB
          </Link>
        }
        actions={
          <Button asChild>
            <Link href="/admin/master/hotelier-templates/new">
              <Plus className="h-4 w-4" /> 신규
            </Link>
          </Button>
        }
      />
      {items.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <EmptyState
              icon={<FileText className="h-6 w-6" />}
              title="등록된 템플릿이 없습니다"
              description="자주 쓰는 접수 양식을 등록해두면 호텔리어가 버튼 한 번으로 본문을 채울 수 있습니다."
              action={
                <Button asChild size="sm">
                  <Link href="/admin/master/hotelier-templates/new">
                    신규 추가
                  </Link>
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {items.map((it) => (
                <li
                  key={it.id}
                  className={`flex items-center justify-between gap-3 p-4 hover:bg-slate-50 dark:hover:bg-slate-900/40 ${
                    it.isActive ? '' : 'opacity-50'
                  }`}
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold">{it.title}</span>
                      <Badge tone="slate">정렬 {it.sortOrder}</Badge>
                      {it.category && <Badge tone="slate">{it.category}</Badge>}
                      {!it.isActive && <Badge tone="danger">비활성</Badge>}
                    </div>
                    <span className="line-clamp-2 whitespace-pre-wrap text-xs text-slate-500 dark:text-slate-400">
                      {it.content}
                    </span>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/admin/master/hotelier-templates/${it.id}`}>
                      편집
                    </Link>
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
