/**
 * /admin/master/inquiry-classification — 문의 분류 (통합 마스터, 2026-06-09).
 *
 * categories(이슈유형/긴급도/영향범위) + ticket_channels(유입 채널)를 한 페이지 탭으로 통합.
 * ?tab=issue_type|urgency|impact|channels. 매니저+어드민(메뉴 접근 제어 가드는 layout).
 * 채널 신규/편집은 기존 /admin/master/ticket-channels/{new,[id]} 라우트 재사용.
 */

import Link from 'next/link';
import { ArrowLeft, Layers, Lock, Plus, Radio } from 'lucide-react';

import { requireRole } from '@/lib/permissions';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { listAllCategories } from '@/lib/services/master-categories';
import {
  isSystemChannelCode,
  listTicketChannels,
} from '@/lib/services/master-ticket-channels';
import { CHANNEL_ICON_MAP, FALLBACK_ICON } from '@/lib/ticket-channel-label';
import type { CategoryType } from '@/db/schema';
import { CategoriesEditor } from '../categories/_components/categories-editor';
import { ToggleActiveButton } from '../ticket-channels/_components/toggle-active-button';

export const dynamic = 'force-dynamic';
export const metadata = { title: '문의 분류 — 마스터DB' };

type TabKey = CategoryType | 'channels';

const TABS: Array<{ key: TabKey; label: string; description: string }> = [
  {
    key: 'issue_type',
    label: '이슈 유형',
    description: '오류 · 장애 · 기능문의 · 기능개발 · 데이터수정 · 기타',
  },
  {
    key: 'urgency',
    label: '긴급도',
    description: 'P1 (긴급) · P2 (보통) · P3 (낮음)',
  },
  {
    key: 'impact',
    label: '영향 범위',
    description: '전체 호텔 · 단일 호텔 · 단일 사용자 · 정보성',
  },
  {
    key: 'channels',
    label: '유입 채널',
    description: '전화 · 카카오 · 이메일 · 방문 등 문의 유입 경로',
  },
];

const BASE_PATH = '/admin/master/inquiry-classification';

type SearchParams = Promise<{ tab?: string }>;

export default async function InquiryClassificationPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireRole(['manager', 'admin']);
  const sp = await searchParams;
  const activeTab: TabKey =
    sp.tab && TABS.some((t) => t.key === sp.tab) ? (sp.tab as TabKey) : 'issue_type';
  const activeMeta = TABS.find((t) => t.key === activeTab)!;
  const isChannels = activeTab === 'channels';

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="문의 분류"
        description="이슈 유형 · 긴급도 · 영향 범위와 유입 채널을 한 곳에서 관리합니다. (제품 분류는 ‘제품 카테고리’ 메뉴)"
        breadcrumb={
          <Link
            href="/admin/master"
            className="inline-flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <ArrowLeft className="h-3 w-3" /> 마스터DB
          </Link>
        }
        actions={
          isChannels ? (
            <Button asChild>
              <Link href="/admin/master/ticket-channels/new">
                <Plus className="h-4 w-4" /> 신규 채널
              </Link>
            </Button>
          ) : undefined
        }
      />

      {/* 탭 */}
      <nav className="flex flex-wrap gap-1 border-b border-slate-200 pb-1 dark:border-slate-800">
        {TABS.map((tab) => {
          const isActive = tab.key === activeTab;
          return (
            <Link
              key={tab.key}
              href={{ pathname: BASE_PATH, query: { tab: tab.key } }}
              className={
                isActive
                  ? 'rounded-md bg-brand-100 px-3 py-1.5 text-sm font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300'
                  : 'rounded-md px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800'
              }
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <Card>
        <CardContent className="flex flex-col gap-1 p-4">
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {activeMeta.label}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {activeMeta.description}
          </div>
        </CardContent>
      </Card>

      {isChannels ? (
        <ChannelsPanel />
      ) : (
        <CategoryPanel type={activeTab as CategoryType} />
      )}
    </div>
  );
}

/** 카테고리 탭 (이슈유형/긴급도/영향범위) — 구 /admin/master/categories 본문 이관 */
async function CategoryPanel({ type }: { type: CategoryType }) {
  const items = await listAllCategories(type, true);
  return (
    <>
      {items.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <EmptyState
              icon={<Layers className="h-6 w-6" />}
              title="등록된 항목이 없습니다"
              description="아래 폼에서 신규 추가하세요."
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <CategoriesEditor type={type} items={items} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              신규 추가
            </h3>
            <Button variant="ghost" size="sm" type="button" asChild>
              <Link href={{ pathname: BASE_PATH, query: { tab: type } }}>
                새로고침
              </Link>
            </Button>
          </div>
          <CategoriesEditor type={type} items={items} createOnly />
        </CardContent>
      </Card>
    </>
  );
}

/** 유입 채널 탭 — 구 /admin/master/ticket-channels 본문 이관 */
async function ChannelsPanel() {
  const items = await listTicketChannels({ includeInactive: true });
  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <EmptyState
            icon={<Radio className="h-6 w-6" />}
            title="등록된 채널이 없습니다"
            description="시드를 실행하지 않았다면 `npm run db:seed`를 먼저 실행해주세요."
            action={
              <Button asChild size="sm">
                <Link href="/admin/master/ticket-channels/new">신규 추가</Link>
              </Button>
            }
          />
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardContent className="p-0">
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {items.map((c) => {
            const Icon = c.icon
              ? (CHANNEL_ICON_MAP[c.icon] ?? FALLBACK_ICON)
              : FALLBACK_ICON;
            const system = isSystemChannelCode(c.code);
            return (
              <li
                key={c.id}
                className={`flex items-center justify-between gap-3 p-4 hover:bg-slate-50 dark:hover:bg-slate-900/40 ${
                  c.isActive ? '' : 'opacity-50'
                }`}
              >
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {c.label}
                      </span>
                      <code className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                        {c.code}
                      </code>
                      {system && (
                        <Badge tone="slate">
                          <Lock className="mr-1 h-3 w-3" />
                          시스템
                        </Badge>
                      )}
                      {c.isAgentDefault && <Badge tone="brand">기본</Badge>}
                      {!c.selectableInAgentForm && (
                        <Badge tone="warn">대리폼 숨김</Badge>
                      )}
                      {!c.isActive && <Badge tone="danger">비활성</Badge>}
                      <Badge tone="slate">정렬 {c.sortOrder}</Badge>
                    </div>
                    {c.description && (
                      <span className="line-clamp-1 text-xs text-slate-500 dark:text-slate-400">
                        {c.description}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <ToggleActiveButton
                    id={c.id}
                    isActive={c.isActive}
                    isSystem={system}
                  />
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/admin/master/ticket-channels/${c.id}`}>
                      편집
                    </Link>
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
