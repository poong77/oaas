/**
 * /role/[key] — 역할별 시작하기 (B2 — DB 기반).
 *
 * 데이터 흐름:
 *   - getRoleStarterWithArticles(key) → DB에서 role + 매핑된 발행 아티클 fetch
 *   - DB에 매핑 없으면 ROLE_STARTERS 정적 상수 폴백 (기존 호환)
 *
 * @see docs/02-design/knowledge-base-overhaul/DESIGN.md §15-2
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, BookOpen, ExternalLink } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { ROLE_STARTERS } from '@/app/_components/home/_constants';
import { getRoleStarterWithArticles } from '@/lib/services/master-role-starters';
import { resolveIcon } from '@/app/_components/home/_icon-map';

type RouteParams = Promise<{ key: string }>;

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: RouteParams }) {
  const { key } = await params;
  const staticRole = ROLE_STARTERS.find((r) => r.key === key);
  return {
    title: staticRole
      ? `${staticRole.label} 시작하기 — OA 통합 AS`
      : '역할별 시작하기 — OA 통합 AS',
  };
}

export default async function RoleStarterPage({
  params,
}: {
  params: RouteParams;
}) {
  const { key } = await params;

  // DB 우선
  const fromDb = await getRoleStarterWithArticles(key);
  const staticRole = ROLE_STARTERS.find((r) => r.key === key);

  if (!fromDb && !staticRole) notFound();

  const label = fromDb?.starter.label ?? staticRole!.label;
  const description = fromDb?.starter.description ?? staticRole!.description;
  const iconName = fromDb?.starter.icon;
  const Icon = iconName ? resolveIcon(iconName) : staticRole!.icon;

  const articles = fromDb?.articles ?? [];

  const others = ROLE_STARTERS.filter((r) => r.key !== key);

  return (
    <div
      data-testid="role-starter-page"
      className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10 lg:px-8"
    >
      <PageHeader
        title={`${label} 시작하기`}
        description={description}
        breadcrumb={
          <Link
            href="/"
            className="inline-flex items-center gap-1 hover:underline"
          >
            <ArrowLeft className="h-3 w-3" />홈
          </Link>
        }
      />

      <Card>
        <CardContent className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-100 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300">
            <Icon className="h-6 w-6" />
          </span>
          <p className="flex-1 text-sm text-slate-600 dark:text-slate-300">
            {description}
          </p>
        </CardContent>
      </Card>

      {articles.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <EmptyState
              icon={<BookOpen className="h-6 w-6" />}
              title="추천 가이드가 준비 중입니다"
              description="현재는 제품별 가이드 / FAQ / 체크리스트로 학습하실 수 있어요."
              action={
                <Button asChild size="sm" variant="outline">
                  <Link href="/help">제품별 가이드 보기</Link>
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            추천 가이드 ({articles.length}건)
          </h2>
          <ol className="flex flex-col gap-3">
            {articles.map((a, idx) => (
              <li key={a.id} data-testid="role-article-card">
                <Card className="transition hover:border-brand-300 dark:hover:border-brand-700">
                  <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start">
                    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                      {idx + 1}
                    </span>
                    <div className="flex-1">
                      <div className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-wider text-slate-400">
                        <span>{a.productCode}</span>
                        <span>·</span>
                        <span>{a.contentType}</span>
                      </div>
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        <Link
                          href={`/help/${a.productCode}/${a.contentType}/${a.slug}`}
                          className="hover:underline"
                        >
                          {a.title}
                        </Link>
                      </h3>
                      {a.summary && (
                        <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                          {a.summary}
                        </p>
                      )}
                    </div>
                    <ExternalLink className="hidden h-4 w-4 text-slate-300 sm:block" />
                  </CardContent>
                </Card>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">다른 역할도 살펴보기</h3>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {others.map((o) => (
            <li key={o.key}>
              <Link
                href={`/role/${o.key}`}
                className="block rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-medium hover:border-brand-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-brand-700"
              >
                {o.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
