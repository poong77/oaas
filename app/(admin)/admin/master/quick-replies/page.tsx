/**
 * /admin/master/quick-replies — 빠른 응대 (Phase 9).
 */

import Link from 'next/link';
import { ArrowLeft, MessageSquare, Plus } from 'lucide-react';

import { requireRole } from '@/lib/permissions';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { listQuickReplies } from '@/lib/services/master-quick-replies';

export const dynamic = 'force-dynamic';
export const metadata = { title: '빠른 응대 — 마스터 데이터' };

export default async function MasterQuickRepliesPage() {
  await requireRole(['manager', 'admin']);
  const items = await listQuickReplies(true);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="빠른 응대 템플릿"
        description="매니저가 티켓 답변 작성 시 사용할 정형 응대 문구."
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
            <Link href="/admin/master/quick-replies/new">
              <Plus className="h-4 w-4" /> 신규
            </Link>
          </Button>
        }
      />
      {items.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <EmptyState
              icon={<MessageSquare className="h-6 w-6" />}
              title="등록된 응대 문구가 없습니다"
              description="자주 쓰는 답변 문구를 미리 등록해두면 응답 시간이 단축됩니다."
              action={
                <Button asChild size="sm">
                  <Link href="/admin/master/quick-replies/new">신규 추가</Link>
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
                      {it.category && <Badge tone="slate">{it.category}</Badge>}
                      {!it.isActive && <Badge tone="danger">비활성</Badge>}
                    </div>
                    <span className="line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                      {it.content}
                    </span>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/admin/master/quick-replies/${it.id}`}>편집</Link>
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
