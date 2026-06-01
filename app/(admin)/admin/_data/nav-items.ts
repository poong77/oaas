/**
 * 어드민/매니저 사이드바 메뉴 정의.
 *
 * 분리 이유: 데스크탑 AdminSidebar와 모바일 AdminMobileHeader(Sheet)가
 * 동일한 NavItem 컴포넌트를 공유하도록 데이터를 단일 소스로 둔다.
 *
 * 그룹화 (역할 + 운영 우선순위):
 *   - tickets: 티켓 큐, 서비스 상태 (매니저 최우선 작업 영역)
 *   - content: 아티클, 공지, FAQ, 체크리스트 (응대 근거 콘텐츠)
 *   - org:     사용자(admin), 호텔(admin), 마스터 데이터 (조직 마스터)
 *
 * 매니저는 admin-only 메뉴를 자물쇠(disabled)로 인지할 수 있다.
 *
 * @see docs/02-design/features/admin-sidebar-layout.design.md §3.9
 */

import {
  Activity,
  Building2,
  Database,
  FileText,
  HelpCircle,
  Inbox,
  ListChecks,
  Megaphone,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { UserRole } from '@/db/schema';

export type TabGroup = 'tickets' | 'content' | 'org';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** 실제 진입 가능 역할. 매니저가 진입 못 하면 자물쇠 표시. */
  roles: UserRole[];
  group: TabGroup;
}

export const NAV_ITEMS: NavItem[] = [
  // 티켓 운영
  {
    href: '/admin/tickets',
    label: '티켓 큐',
    icon: Inbox,
    roles: ['manager', 'admin'],
    group: 'tickets',
  },
  {
    href: '/admin/service-status',
    label: '서비스 상태',
    icon: Activity,
    roles: ['manager', 'admin'],
    group: 'tickets',
  },
  // 콘텐츠
  {
    href: '/admin/articles',
    label: '아티클',
    icon: FileText,
    roles: ['manager', 'admin'],
    group: 'content',
  },
  {
    href: '/admin/notices',
    label: '공지 관리',
    icon: Megaphone,
    roles: ['manager', 'admin'],
    group: 'content',
  },
  {
    href: '/admin/faqs',
    label: 'FAQ',
    icon: HelpCircle,
    roles: ['manager', 'admin'],
    group: 'content',
  },
  {
    href: '/admin/checklists',
    label: '체크리스트',
    icon: ListChecks,
    roles: ['manager', 'admin'],
    group: 'content',
  },
  // 조직 & 마스터
  {
    href: '/admin/users',
    label: '사용자',
    icon: Users,
    roles: ['admin'],
    group: 'org',
  },
  {
    href: '/admin/hotels',
    label: '호텔',
    icon: Building2,
    roles: ['admin'],
    group: 'org',
  },
  {
    href: '/admin/master',
    label: '마스터 데이터',
    icon: Database,
    roles: ['manager', 'admin'],
    group: 'org',
  },
];

export const GROUP_ORDER: TabGroup[] = ['tickets', 'content', 'org'];

export const GROUP_LABEL: Record<TabGroup, string> = {
  tickets: '티켓 운영',
  content: '콘텐츠',
  org: '조직 & 마스터',
};
