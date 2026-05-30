/**
 * /help — 핸드북 허브 (SS-02).
 *
 * Phase 3:
 *   - 제품 카드 6개 (각 제품별 발행 아티클 수 표시)
 *   - 검색 인풋 (Hero)
 *   - 인기 아티클 5건 (전체 제품 통합)
 *   - 채널.io 외부 링크 안내
 */

import Link from 'next/link';
import { ArrowRight, ExternalLink } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { getProductCategories } from '@/lib/services/categories';
import {
  getArticleCountsByProduct,
  listPopularArticles,
} from '@/lib/services/articles';
import { resolveIcon } from '@/app/_components/home/_icon-map';
import { ContactPanel } from '@/components/contact/contact-panel';
import { HelpHeroSearch } from './_components/help-hero-search';
import { PopularArticleList } from './_components/popular-article-list';

export const dynamic = 'force-dynamic';
export const metadata = { title: '제품별 가이드 — OA 통합 AS' };

export default async function HelpIndexPage() {
  const [categories, counts, popular] = await Promise.all([
    getProductCategories(),
    getArticleCountsByProduct(),
    listPopularArticles(5),
  ]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <div className="grid gap-8 lg:grid-cols-[1fr_300px] lg:gap-10">
        <div className="flex flex-col gap-8">
      <PageHeader
        title="제품별 가이드"
        description="PMS · CMS · Keyless · 키오스크 · 웹서비스 핸드북을 한 곳에서 찾아보세요."
      />

      <HelpHeroSearch />

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-bold tracking-tight sm:text-base">
          제품별로 보기
        </h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {categories.map((cat) => {
            const Icon = resolveIcon(cat.icon);
            const count = counts[cat.code] ?? 0;
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
                  <span className="text-xs font-medium text-slate-500 group-hover:text-brand-600 dark:text-slate-400 dark:group-hover:text-brand-300">
                    {count > 0 ? `아티클 ${count}건` : '곧 추가됩니다'}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs text-brand-600 group-hover:text-brand-700 dark:text-brand-400">
                    가이드 보기 <ArrowRight className="h-3 w-3" />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-bold tracking-tight sm:text-base">
          인기 아티클
        </h2>
        <Card>
          <CardContent className="p-0">
            <PopularArticleList items={popular} />
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardContent className="flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm">
            <p className="font-medium text-slate-700 dark:text-slate-200">
              기존 help.oapms.com 자료 안내
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {/* TODO(phase-3-temp): help.oapms.com 마이그레이션은 Phase 3에서 진행하지 않음. */}
              기존 채널.io 도움말 자료는 외부 사이트에서 그대로 확인 가능합니다.
            </p>
          </div>
          <a
            href="https://help.oapms.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 self-start rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium hover:border-brand-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-brand-700"
          >
            help.oapms.com 열기
            <ExternalLink className="h-3 w-3" />
          </a>
        </CardContent>
      </Card>
        </div>
        <ContactPanel variant="sidebar" />
      </div>
    </div>
  );
}
