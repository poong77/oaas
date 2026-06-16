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
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { ROLE_STARTERS } from '@/app/_components/home/_constants';
import {
  getRoleStarterWithArticles,
  listActiveRoleStarters,
} from '@/lib/services/master-role-starters';
import { CONTENT_TYPE_META } from '@/lib/articles/content-type-meta';
import type { ArticleContentType } from '@/db/schema';
import { MasterIcon } from '@/components/master-icon';
import { RoleFaqList } from './_components/role-faq-list';

type RouteParams = Promise<{ key: string }>;

export const dynamic = 'force-dynamic';

/**
 * 역할별 콜아웃 안내문 — "왜 이 페이지가 중요한지 / 무엇을 익혀야 하는지".
 * 강사가 말하듯 전문적이면서 친근한 톤. DB에 별도 필드가 없어 정적 큐레이션.
 * 미정의 역할은 description으로 폴백.
 */
const ROLE_INTRO: Record<string, string> = {
  front:
    '프론트는 고객이 호텔에서 가장 먼저, 그리고 가장 자주 마주하는 접점입니다. 체크인·체크아웃·키 발급이 막힘없이 흘러가야 대기 줄도 컴플레인도 줄어듭니다. 아래 가이드를 따라 예약 조회부터 키 재발급까지 손에 익혀 두시면, 가장 바쁜 시간대에도 흔들리지 않습니다.',
  sales:
    '예약·판매는 객실 가동률과 매출이 직접 갈리는 자리입니다. 요금을 어떻게 세팅하고 OTA를 어떻게 연동하느냐에 따라 같은 객실도 수익이 달라지죠. 예약 등록·요금 관리·채널 연동의 기본기를 여기서 차근차근 익혀 두세요.',
  housekeeping:
    '하우스키핑은 객실 상태가 시스템과 정확히 맞아떨어져야 프론트도 고객도 헛걸음하지 않습니다. 청소·점검 상태를 제때 동기화하고 키오스크와 연동하는 흐름을 익혀 두시면, 객실 배정 사고를 크게 줄일 수 있습니다. 아래 순서대로 따라와 보세요.',
  manager:
    '관리자는 직원·권한·매출을 한눈에 보고 의사결정을 내리는 자리입니다. 누구에게 어떤 권한을 줄지, 리포트를 어떻게 읽을지 알아야 운영이 안정됩니다. 이 페이지에서 권한 설계와 리포트 해석의 핵심부터 짚어 보세요.',
  new_open:
    '신규 오픈은 첫 단추를 잘 끼우는 것이 전부라 해도 과언이 아닙니다. 초기 설정을 빠뜨리면 오픈 후에 두 배로 고생하게 되죠. 아래 체크리스트를 순서대로 따라가며 오픈 전 셋업을 빈틈없이 마쳐 두세요.',
};

export async function generateMetadata({ params }: { params: RouteParams }) {
  const { key } = await params;
  const staticRole = ROLE_STARTERS.find((r) => r.key === key);
  return {
    title: staticRole
      ? `${staticRole.label} 시작하기 — OA서포트`
      : '역할별 시작하기 — OA서포트',
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
  // 콜아웃: 정적 큐레이션 안내문 우선, 없으면 description 폴백
  const intro = ROLE_INTRO[key] ?? description;

  const articles = fromDb?.articles ?? [];
  const faqs = fromDb?.faqs ?? [];

  // 다른 역할 — 어드민(역할별 마스터)에 등록된 아이콘/라벨 우선, 없으면 정적 폴백
  const allStarters = await listActiveRoleStarters();
  const dbByKey = new Map(allStarters.map((s) => [s.roleKey, s] as const));
  const others = ROLE_STARTERS.filter((r) => r.key !== key).map((r) => {
    const db = dbByKey.get(r.key);
    return {
      key: r.key,
      label: db?.label ?? r.label,
      iconName: db?.icon ?? null,
      iconImageUrl: db?.iconImageUrl ?? null,
      fallbackIcon: r.icon,
    };
  });

  return (
    <div data-testid="role-starter-page" className="px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6">
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

      <Card className="border-brand-200 bg-brand-50/60 dark:border-brand-900/50 dark:bg-brand-950/20">
        <CardContent className="flex flex-col items-start gap-4 p-6 sm:flex-row">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300">
            <MasterIcon
              iconName={fromDb?.starter.icon}
              iconImageUrl={fromDb?.starter.iconImageUrl}
              fallback={staticRole?.icon}
              className="h-6 w-6"
            />
          </span>
          <div className="flex-1">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-300">
              이 역할을 시작하기 전에
            </p>
            <p className="text-sm leading-7 text-slate-700 dark:text-slate-200">
              {intro}
            </p>
          </div>
        </CardContent>
      </Card>

      {articles.length === 0 && faqs.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <EmptyState
              icon={<BookOpen className="h-6 w-6" />}
              title="추천 가이드가 준비 중입니다"
              description="현재는 제품별 가이드 / FAQ / 체크리스트로 학습하실 수 있어요."
              action={
                <Button asChild size="sm" variant="outline">
                  <Link href="/">제품별 가이드 보기</Link>
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : null}

      {articles.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            추천 가이드 ({articles.length}건)
          </h2>
          <ol className="grid gap-3 sm:grid-cols-2">
            {articles.map((a, idx) => {
              const meta = CONTENT_TYPE_META[a.contentType as ArticleContentType];
              return (
                <li key={a.id} data-testid="role-article-card">
                  <Card className="h-full transition hover:border-brand-300 dark:hover:border-brand-700">
                    <CardContent className="flex h-full flex-col gap-2 p-4 sm:flex-row sm:items-start">
                      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                        {idx + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                          {/* 의도 타입 뱃지 — 아티클 카드와 동일(사용방법/기능설명/문제해결) */}
                          {meta && <Badge tone={meta.tone}>{meta.label}</Badge>}
                          <span className="text-[10px] uppercase tracking-wider text-slate-400">
                            {a.productCode}
                          </span>
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
              );
            })}
          </ol>
        </section>
      )}

      {faqs.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            자주 묻는 질문 ({faqs.length}건)
          </h2>
          <RoleFaqList faqs={faqs} />
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">다른 역할도 살펴보기</h3>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {others.map((o) => (
            <li key={o.key}>
              <Link
                href={`/role/${o.key}`}
                className="flex items-center gap-2.5 rounded-md border border-slate-200 bg-white px-3 py-2.5 hover:border-brand-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-brand-700"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300">
                  <MasterIcon
                    iconName={o.iconName}
                    iconImageUrl={o.iconImageUrl}
                    fallback={o.fallbackIcon}
                    className="h-4 w-4"
                  />
                </span>
                <span className="truncate text-xs font-medium">{o.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      </div>
    </div>
  );
}
