/**
 * /admin/master — 어드민 마스터 데이터 인덱스 (Phase 9).
 *
 * 9개 카테고리 카드. 매니저+어드민 진입. system-settings는 어드민만 노출.
 */

import Link from 'next/link';
import {
  ArrowRight,
  Bell,
  BookA,
  Clock,
  Database,
  FolderTree,
  Gauge,
  HelpCircle,
  Layers,
  Link as LinkIcon,
  ListChecks,
  MessageSquare,
  Radio,
  Settings,
  Sparkles,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

import { requireRole } from '@/lib/permissions';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';
export const metadata = { title: '마스터 데이터 — OA 통합 AS 어드민' };

type MasterItem = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  badge?: string;
};

const ITEMS: MasterItem[] = [
  {
    href: '/admin/master/categories',
    label: '카테고리',
    description:
      '제품 / 이슈 유형 / 긴급도 / 영향 범위 4종을 편집합니다. 홈/검색/접수폼 전반 영향.',
    icon: Layers,
  },
  {
    href: '/admin/master/notification-templates',
    label: '알림 템플릿',
    description:
      'SMS/이메일 알림 본문 템플릿. 티켓 상태 전환·계정 초대·비밀번호 초기화.',
    icon: Bell,
  },
  {
    href: '/admin/master/quick-replies',
    label: '빠른 응대',
    description: '매니저가 티켓 답변 작성 시 사용할 정형 응대 문구 템플릿.',
    icon: MessageSquare,
  },
  {
    href: '/admin/master/quick-actions',
    label: '자주 찾는 작업',
    description: '홈 ④ 카드. 비밀번호 초기화 등 단축 메뉴. 즉시 홈에 반영.',
    icon: Sparkles,
    badge: '홈 노출',
  },
  {
    href: '/admin/master/role-starters',
    label: '역할별 시작',
    description: '홈 ⑤ 카드. 프론트/예약/하우스키핑/관리자/신규오픈 5종.',
    icon: ListChecks,
    badge: '홈 노출',
  },
  {
    href: '/admin/master/solution-links',
    label: '솔루션 링크 프리셋',
    description: '호텔 프로필에서 사용자가 추가할 솔루션 링크 후보.',
    icon: LinkIcon,
  },
  {
    href: '/admin/master/form-fields',
    label: '접수 폼 필드',
    description: '제품별 동적 접수 폼 필드 정의. NULL이면 전 제품 공통.',
    icon: Wrench,
  },
  {
    href: '/admin/master/ticket-channels',
    label: '유입 채널',
    description:
      '티켓이 어떤 경로로 들어왔는지 분류 (전화/카카오/이메일 등). 대리 접수 폼 드롭다운에 노출.',
    icon: Radio,
    adminOnly: true,
  },
  {
    href: '/admin/master/business-hours',
    label: '운영시간',
    description:
      '평일 운영·점심·접수마감·긴급전화·공휴일을 관리합니다. 호텔리어 컨택 패널 실시간 운영상태에 반영.',
    icon: Clock,
    adminOnly: true,
    badge: '실시간 반영',
  },
  {
    href: '/admin/master/system-settings',
    label: '시스템 설정',
    description:
      '업로드 한도·로그인 Rate Limit·Slack 채널 등 key-value. (운영시간은 별도 메뉴로 분리)',
    icon: Settings,
    adminOnly: true,
  },
  {
    href: '/admin/master/synonyms',
    label: '동의어 사전',
    description:
      '검색 동의어 그룹·이형어 관리. 통합 검색 시 자동 확장 (예: "결제" ↔ "페이먼트").',
    icon: BookA,
    adminOnly: true,
  },
  {
    href: '/admin/master/menu-taxonomies',
    label: '메뉴 구조',
    description:
      '도움말 아티클의 menu_path 정본. 제품별 대/중/소 메뉴 트리 (최대 3단). 아티클 작성 시 cascading select 옵션 소스.',
    icon: FolderTree,
    adminOnly: true,
  },
  {
    href: '/admin/master/search-quality',
    label: '검색 골든셋·품질',
    description:
      '자주 묻는 질문(정답셋)을 검색에 돌려 순위 측정 (Hit@k·버킷). AI 추천·실사용 퍼널(노출→클릭→접수)까지.',
    icon: Gauge,
    badge: '품질 측정',
  },
];

export default async function AdminMasterIndexPage() {
  const user = await requireRole(['manager', 'admin']);
  const items = ITEMS.filter((it) => !it.adminOnly || user.role === 'admin');

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="마스터 데이터"
        guideAnchor="master"
        description="어드민 편집 가능한 마스터 데이터를 도메인별로 관리합니다."
      />

      <Card>
        <CardContent className="p-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((it) => {
              const Icon = it.icon;
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
                      {it.adminOnly && (
                        <Badge tone="warn" className="text-[10px]">
                          어드민
                        </Badge>
                      )}
                      <ArrowRight className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {it.label}
                    </span>
                    <span className="text-xs leading-snug text-slate-500 dark:text-slate-400">
                      {it.description}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-start gap-3 p-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300">
            <HelpCircle className="h-4 w-4" />
          </span>
          <div className="flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-300">
            <strong className="text-slate-900 dark:text-slate-100">
              마스터 데이터 편집 안내
            </strong>
            <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              모든 마스터 데이터는 <span className="font-mono">is_active</span>
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
        Phase 9 — 어드민 마스터 데이터 편집
      </p>
    </div>
  );
}
