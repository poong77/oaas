import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { requireRole } from '@/lib/permissions';
import { getRoleStarterById } from '@/lib/services/master-role-starters';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { RoleStarterUpsert } from '../_components/role-starter-upsert';
import type { MappedArticle } from '../_components/role-starter-article-mapper';
import { db } from '@/db';
import { articles } from '@/db/schema';
import { and, eq, inArray } from 'drizzle-orm';

export const dynamic = 'force-dynamic';
export const metadata = { title: '역할 편집 — 마스터 데이터' };

type Params = Promise<{ id: string }>;

export default async function RoleStarterEditPage({
  params,
}: {
  params: Params;
}) {
  await requireRole(['manager', 'admin']);
  const { id } = await params;
  const item = await getRoleStarterById(id);
  if (!item) notFound();

  // D3 — articleIds 순서대로 article 정보 fetch (활성/비활성 모두, 매니저가 발행 전 매핑 가능)
  let initialArticles: MappedArticle[] = [];
  if (db && item.articleIds && item.articleIds.length > 0) {
    try {
      const rows = await db
        .select({
          id: articles.id,
          slug: articles.slug,
          title: articles.title,
          productCode: articles.productCode,
        })
        .from(articles)
        .where(
          and(
            inArray(articles.id, item.articleIds),
            eq(articles.isActive, true),
          ),
        );
      const byId = new Map(rows.map((r) => [r.id, r] as const));
      initialArticles = item.articleIds
        .map((aid) => byId.get(aid))
        .filter((r): r is NonNullable<typeof r> => !!r);
    } catch (err) {
      console.error('[role-starters/[id]] articles fetch 실패:', err);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={`역할 편집 — ${item.label}`}
        breadcrumb={
          <Link
            href="/admin/master/role-starters"
            className="inline-flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <ArrowLeft className="h-3 w-3" /> 역할별 시작
          </Link>
        }
      />
      <Card>
        <CardContent className="p-4">
          <RoleStarterUpsert item={item} initialArticles={initialArticles} />
        </CardContent>
      </Card>
    </div>
  );
}
