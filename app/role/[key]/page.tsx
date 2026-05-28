/**
 * /role/[key] — 역할별 시작하기 placeholder.
 *
 * Phase 9에서 role_starters 테이블 + article 매핑 구현.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { ROLE_STARTERS } from '@/app/_components/home/_constants';

type RouteParams = Promise<{ key: string }>;

export async function generateMetadata({ params }: { params: RouteParams }) {
  const { key } = await params;
  const role = ROLE_STARTERS.find((r) => r.key === key);
  return {
    title: role
      ? `${role.label} 시작하기 — OA 통합 AS`
      : '역할별 시작하기 — OA 통합 AS',
  };
}

export default async function RoleStarterPage({
  params,
}: {
  params: RouteParams;
}) {
  const { key } = await params;
  const role = ROLE_STARTERS.find((r) => r.key === key);
  if (!role) notFound();

  const Icon = role.icon;
  const others = ROLE_STARTERS.filter((r) => r.key !== role.key);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <PageHeader
        title={`${role.label} 시작하기`}
        description={role.description}
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
            {role.label} 역할에 맞춰 추천 가이드를 모아 보여드릴 예정입니다.
            Phase 9에서 역할별 가이드 매핑이 추가됩니다.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <EmptyState
            title="추천 가이드가 준비 중입니다"
            description="현재는 제품별 가이드 / FAQ / 체크리스트로 학습하실 수 있습니다."
            action={
              <Button asChild size="sm" variant="outline">
                <Link href="/help">제품별 가이드 보기</Link>
              </Button>
            }
          />
        </CardContent>
      </Card>

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
