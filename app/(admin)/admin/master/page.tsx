/**
 * /admin/master — 어드민 마스터DB 인덱스 (Phase 9 · 재구성 2026-06-09).
 *
 * 5개 섹션 헤더 + 한 줄 4개 그리드 + 제목만 타일.
 * 카드 노출/‘어드민’ 뱃지는 메뉴 접근 제어(getManagerAccessMap)가 단일 소스.
 * 통합: 문의 분류(categories+ticket_channels) · 메시지 템플릿(notification+quick-replies).
 * 삭제: 자주 찾는 작업(quick_actions) · 접수 폼 필드(ticket_form_fields).
 */

import Link from 'next/link';
import {
  Activity,
  ArrowRight,
  BookA,
  Boxes,
  Bot,
  Clock,
  Compass,
  Cpu,
  Database,
  FileText,
  FolderTree,
  Gauge,
  Hash,
  HelpCircle,
  Link as LinkIcon,
  ListChecks,
  MessageSquare,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';

import { requireRole } from '@/lib/permissions';
import { getManagerAccessMap } from '@/lib/services/master-menu-access';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';
export const metadata = { title: '마스터DB — OA 통합 AS 어드민' };

type MasterItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
};

type MasterGroup = {
  label: string;
  items: MasterItem[];
};

const GROUPS: MasterGroup[] = [
  {
    label: '① 분류·구조',
    items: [
      { href: '/admin/master/product-categories', label: '제품 카테고리', icon: Boxes },
      { href: '/admin/master/menu-taxonomies', label: '아티클 메뉴 트리', icon: FolderTree },
      { href: '/admin/master/inquiry-classification', label: '문의 분류', icon: Compass, badge: '통합' },
    ],
  },
  {
    label: '② 접수·응대',
    items: [
      { href: '/admin/master/hotelier-templates', label: '호텔리어 템플릿', icon: FileText, badge: '접수폼 노출' },
      { href: '/admin/master/solution-links', label: '솔루션 링크 프리셋', icon: LinkIcon },
      { href: '/admin/master/message-templates', label: '메시지 템플릿', icon: MessageSquare, badge: '통합' },
    ],
  },
  {
    label: '③ 랜딩페이지',
    items: [
      { href: '/admin/master/service-status', label: '서비스 상태', icon: Activity, badge: '실시간' },
      { href: '/admin/master/role-starters', label: '역할별 시작', icon: ListChecks, badge: '노출' },
      { href: '/admin/master/popular-keywords', label: '인기검색어', icon: Hash, badge: '노출' },
    ],
  },
  {
    label: '④ 검색·AI',
    items: [
      { href: '/admin/master/synonyms', label: '동의어 사전', icon: BookA },
      { href: '/admin/master/search-quality', label: '검색 골든셋·품질', icon: Gauge, badge: '품질' },
      { href: '/admin/master/knowledge-export', label: '지식팩 내보내기', icon: Bot, badge: 'AI 지식' },
      { href: '/admin/master/ai-models', label: 'AI 모델', icon: Cpu, badge: 'AI' },
    ],
  },
  {
    label: '⑤ 시스템·운영',
    items: [
      { href: '/admin/master/business-hours', label: '운영시간', icon: Clock, badge: '실시간' },
      { href: '/admin/master/menu-access', label: '메뉴 접근 제어', icon: ShieldCheck },
    ],
  },
];

/** href 마지막 세그먼트(= 접근 맵 키) */
function menuKeyOf(href: string): string {
  return href.split('/').pop() ?? '';
}

export default async function AdminMasterIndexPage() {
  const user = await requireRole(['manager', 'admin']);
  // 접근 맵(메뉴 접근 제어)이 단일 소스. 어드민은 전체 노출하되 매니저 차단 메뉴엔
  // '어드민' 뱃지로 표시. 매니저는 접근 허용된 카드만 본다.
  const accessMap = await getManagerAccessMap();
  const canSee = (href: string) =>
    user.role === 'admin' || accessMap[menuKeyOf(href)] === true;

  const visibleGroups = GROUPS.map((g) => ({
    label: g.label,
    items: g.items.filter((it) => canSee(it.href)),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="마스터DB"
        guideAnchor="master"
        description="어드민 편집 가능한 마스터DB를 도메인별로 관리합니다."
      />

      <Card>
        <CardContent className="flex flex-col gap-6 p-5">
          {visibleGroups.map((group) => (
            <section key={group.label} className="flex flex-col gap-2.5">
              <div className="flex items-center gap-2 border-b border-slate-200 pb-1.5 dark:border-slate-800">
                <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  {group.label}
                </h2>
                <span className="text-[11px] text-slate-400">
                  {group.items.length}
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {group.items.map((it) => {
                  const Icon = it.icon;
                  // 매니저가 현재 접근 불가한 메뉴 → '어드민' 뱃지 (어드민 화면 한정)
                  const managerBlocked = accessMap[menuKeyOf(it.href)] !== true;
                  return (
                    <Link
                      key={it.href}
                      href={it.href}
                      className="group hover:border-brand-300 dark:hover:border-brand-700 flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="bg-brand-50 text-brand-600 group-hover:bg-brand-600 dark:bg-brand-950/40 dark:text-brand-300 flex h-10 w-10 items-center justify-center rounded-md group-hover:text-white">
                          <Icon className="h-5 w-5" />
                        </span>
                        <div className="flex items-center gap-1">
                          {it.badge && (
                            <Badge tone="brand" className="text-[10px]">
                              {it.badge}
                            </Badge>
                          )}
                          {managerBlocked && (
                            <Badge tone="warn" className="text-[10px]">
                              어드민
                            </Badge>
                          )}
                          <ArrowRight className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-0.5" />
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {it.label}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-start gap-3 p-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300">
            <HelpCircle className="h-4 w-4" />
          </span>
          <div className="flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-300">
            <strong className="text-slate-900 dark:text-slate-100">
              마스터DB 편집 안내
            </strong>
            <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              모든 마스터DB는 <span className="font-mono">is_active</span>
              플래그 기반 소프트 삭제입니다. 비활성화한 항목은 일반 사용자에게
              보이지 않지만 기존 참조(예: 티켓의 product/urgency)는 유지됩니다.
              변경 사항은 즉시 반영되며 모든 액션은{' '}
              <span className="font-mono">activity_logs</span>에 기록됩니다.
            </p>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-slate-400">
        <Database className="mr-1 inline h-3 w-3" />
        Phase 9 — 어드민 마스터DB 편집
      </p>
    </div>
  );
}
