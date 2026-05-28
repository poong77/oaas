'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  Building2,
  Database,
  FileText,
  HelpCircle,
  Inbox,
  ListChecks,
  Lock,
  Megaphone,
  Shield,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AdminUserMenu } from './admin-user-menu';
import type { UserRole } from '@/db/schema';

type TabGroup = 'tickets' | 'content' | 'org';

type Tab = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** 실제 진입 가능 역할. 매니저가 진입 못 하면 자물쇠 표시. */
  roles: UserRole[];
  group: TabGroup;
};

/**
 * 어드민 메뉴 정의.
 *
 * 그룹화 (UX/IA 개편, role-mode-ui Phase):
 *   - tickets: 티켓 큐, 서비스 상태
 *   - content: 아티클, 공지, FAQ, 체크리스트
 *   - org:     사용자(admin), 호텔(admin), 마스터 데이터
 *
 * 매니저는 admin-only 메뉴를 자물쇠(disabled)로 인지할 수 있다. Link가 아닌
 * <button disabled>로 렌더링되어 클릭해도 404 발생 안 함 (design.md §3.6 E6 차단).
 */
const ALL_TABS: Tab[] = [
  // 티켓 운영
  { href: '/admin/tickets', label: '티켓 큐', icon: Inbox, roles: ['manager', 'admin'], group: 'tickets' },
  { href: '/admin/service-status', label: '서비스 상태', icon: Activity, roles: ['manager', 'admin'], group: 'tickets' },
  // 콘텐츠
  { href: '/admin/articles', label: '아티클', icon: FileText, roles: ['manager', 'admin'], group: 'content' },
  { href: '/admin/notices', label: '공지 관리', icon: Megaphone, roles: ['manager', 'admin'], group: 'content' },
  { href: '/admin/faqs', label: 'FAQ', icon: HelpCircle, roles: ['manager', 'admin'], group: 'content' },
  { href: '/admin/checklists', label: '체크리스트', icon: ListChecks, roles: ['manager', 'admin'], group: 'content' },
  // 조직 & 마스터
  { href: '/admin/users', label: '사용자', icon: Users, roles: ['admin'], group: 'org' },
  { href: '/admin/hotels', label: '호텔', icon: Building2, roles: ['admin'], group: 'org' },
  { href: '/admin/master', label: '마스터 데이터', icon: Database, roles: ['manager', 'admin'], group: 'org' },
];

const GROUP_ORDER: TabGroup[] = ['tickets', 'content', 'org'];

export function AdminNav({ role }: { role: UserRole }) {
  const pathname = usePathname();

  // 매니저에게도 admin-only 메뉴를 노출하되 자물쇠 표시 (권한 한계 시각화).
  // 단, locked 메뉴는 <button disabled>로 렌더되어 클릭해도 404 발생 안 함.
  const visibleTabs: Array<Tab & { locked: boolean }> = ALL_TABS.map((t) => ({
    ...t,
    locked: !t.roles.includes(role),
  }));

  return (
    <nav className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3 dark:border-slate-800">
      <div className="flex flex-wrap items-center gap-1.5">
        <div className="mr-1 flex items-center gap-1.5 text-xs font-semibold text-brand-700 dark:text-brand-300">
          <Shield className="h-3.5 w-3.5" aria-hidden />
          {role === 'admin' ? '어드민' : '매니저'}
        </div>

        {GROUP_ORDER.map((group, gi) => {
          const groupTabs = visibleTabs.filter((t) => t.group === group);
          if (groupTabs.length === 0) return null;
          return (
            <div key={group} className="flex items-center gap-1">
              {gi > 0 && (
                <span
                  className="mx-1 hidden h-4 w-px bg-slate-200 dark:bg-slate-700 sm:inline-block"
                  aria-hidden
                />
              )}
              {groupTabs.map((t) => {
                const active =
                  pathname === t.href || pathname.startsWith(t.href + '/');
                const Icon = t.icon;
                if (t.locked) {
                  return (
                    <button
                      key={t.href}
                      type="button"
                      disabled
                      aria-disabled="true"
                      title={`${t.label} — 어드민 권한 필요`}
                      className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-slate-400 dark:text-slate-500"
                    >
                      <Icon className="h-3.5 w-3.5" aria-hidden />
                      {t.label}
                      <Lock className="h-3 w-3" aria-hidden />
                    </button>
                  );
                }
                return (
                  <Link
                    key={t.href}
                    href={t.href}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                      active
                        ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800',
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden />
                    {t.label}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </div>
      <AdminUserMenu />
    </nav>
  );
}
