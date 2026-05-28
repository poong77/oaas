/**
 * /help — 제품별 가이드 목록 placeholder.
 *
 * Phase 3에서 articles 테이블 + 핸드북 페이지 구현.
 * Phase 2에서는 product 카테고리 6개 카드 + Phase 3 안내.
 */

import Link from 'next/link';
import { ArrowRight, BookOpen } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { getProductCategories } from '@/lib/services/categories';
import { resolveIcon } from '@/app/_components/home/_icon-map';

export const dynamic = 'force-dynamic';
export const metadata = { title: '제품별 가이드 — OA 통합 AS' };

export default async function HelpIndexPage() {
  const categories = await getProductCategories();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <PageHeader
        title="제품별 가이드"
        description="PMS · CMS · Keyless · 키오스크 · 웹서비스의 사용 가이드와 핸드북을 제품별로 모아 보여드립니다."
      />

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {categories.map((cat) => {
          const Icon = resolveIcon(cat.icon);
          return (
            <li key={cat.id}>
              <Link
                href={`/help/${cat.code}`}
                className="group flex h-full flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white p-5 text-center shadow-sm hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-brand-700"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand-100 text-brand-600 group-hover:bg-brand-600 group-hover:text-white dark:bg-brand-900/40 dark:text-brand-300 dark:group-hover:bg-brand-500 dark:group-hover:text-white">
                  <Icon className="h-6 w-6" />
                </span>
                <span className="text-sm font-semibold">{cat.label}</span>
                <span className="inline-flex items-center gap-1 text-xs text-slate-500 group-hover:text-brand-600 dark:text-slate-400 dark:group-hover:text-brand-300">
                  가이드 보기 <ArrowRight className="h-3 w-3" />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <Card>
        <CardContent className="p-6">
          <EmptyState
            icon={<BookOpen className="h-6 w-6" />}
            title="핸드북 콘텐츠는 Phase 3에서 추가됩니다"
            description="현재 help.oapms.com (채널.io)에 있는 도움말 콘텐츠를 정식 이관할 예정입니다. 그동안 카테고리별 페이지에서 임시 안내를 확인하실 수 있습니다."
          />
        </CardContent>
      </Card>
    </div>
  );
}
