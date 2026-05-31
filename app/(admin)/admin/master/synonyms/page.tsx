/**
 * /admin/master/synonyms — 동의어 사전 인덱스.
 *
 * 그룹 리스트 + "+ 새 그룹" 링크. 어드민 only.
 */

import Link from 'next/link';
import { ArrowRight, BookA, Plus } from 'lucide-react';
import { requireRole } from '@/lib/permissions';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { listTermGroups } from '@/lib/services/master-synonyms';
import { KeywordGapCard } from './_components/keyword-gap-card';

export const dynamic = 'force-dynamic';
export const metadata = { title: '동의어 사전 — 마스터' };

const CATEGORY_LABEL: Record<string, string> = {
  operation: '운영',
  housekeeping: '청소',
  fnb: 'F&B',
  frontdesk: '프런트',
  pms: 'PMS',
  product: '제품',
  issue: '장애',
  role: '직무',
  misc: '기타',
};

export default async function SynonymsIndexPage() {
  await requireRole(['admin']);
  const groups = await listTermGroups({ includeInactive: false });

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="동의어 사전"
        description="통합 검색 동의어 그룹 관리. 대표어 + 이형어(N개)로 검색 결과 확장."
      />

      <KeywordGapCard />

      <div className="flex justify-end">
        <Link href="/admin/master/synonyms/new">
          <Button>
            <Plus className="h-4 w-4" />새 그룹
          </Button>
        </Link>
      </div>

      {groups.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <BookA className="h-10 w-10 text-slate-300" />
            <p className="text-sm text-slate-500 dark:text-slate-400">
              아직 등록된 동의어 그룹이 없습니다.
            </p>
            <Link href="/admin/master/synonyms/new">
              <Button size="sm">
                <Plus className="h-3 w-3" />첫 그룹 추가
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {groups.map((g) => (
                <li key={g.id}>
                  <Link
                    href={`/admin/master/synonyms/${g.id}`}
                    className="group flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-300">
                      <BookA className="h-4 w-4" />
                    </div>
                    <div className="flex flex-1 flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {g.canonicalTerm}
                        </span>
                        <Badge tone="brand" className="text-[10px]">
                          {CATEGORY_LABEL[g.category] ?? g.category}
                        </Badge>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          동의어 {g.synonymCount}개
                        </span>
                      </div>
                      {g.description && (
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {g.description}
                        </span>
                      )}
                    </div>
                    <ArrowRight className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
