'use client';

/**
 * ProfileTabsShell — 마이페이지 좌측 탭 내비 셸 (시안 스타일, 2026-06-10).
 *
 * 탭 구성은 page.tsx에서 배열로 주입한다(탭 유지 + 메뉴 추가 정책, 2026-06-11):
 *   내 정보 / 비밀번호 변경 / 호텔 & 솔루션 / 직원 목록 / 변경이력
 * 마지막 탭(변경이력)은 데스크톱에서 하단으로 밀어 배치(footer 영역).
 */

import { useState } from 'react';
import {
  Building2,
  History,
  KeyRound,
  User as UserIcon,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * 아이콘은 서버→클라이언트 경계를 넘길 수 없으므로(함수 직렬화 불가)
 * key로 매핑한다. page.tsx는 직렬화 가능한 값(key/label/node/footer)만 전달한다.
 */
const TAB_ICONS: Record<string, LucideIcon> = {
  profile: UserIcon,
  password: KeyRound,
  hotel: Building2,
  staff: Users,
  history: History,
};

export type ProfileTab = {
  key: string;
  label: string;
  node: ReactNode;
  /** true면 데스크톱 세로 내비에서 하단(footer)으로 분리 배치 */
  footer?: boolean;
};

type UserCard = {
  name: string;
  email: string;
  phone: string;
  hotelName: string;
  title: string;
};

export function ProfileTabsShell({
  user,
  tabs,
}: {
  user: UserCard;
  tabs: ProfileTab[];
}) {
  const [active, setActive] = useState(tabs[0]?.key ?? '');

  const subline = [user.hotelName, user.title].filter(Boolean).join(' · ');
  const mainTabs = tabs.filter((t) => !t.footer);
  const footerTabs = tabs.filter((t) => t.footer);

  function NavButton({ tab }: { tab: ProfileTab }) {
    const isActive = tab.key === active;
    const Icon = TAB_ICONS[tab.key] ?? UserIcon;
    return (
      <button
        type="button"
        onClick={() => setActive(tab.key)}
        className={`flex shrink-0 items-center gap-2.5 rounded-lg px-4 py-2.5 text-left text-sm font-medium transition-colors ${
          isActive
            ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
        }`}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {tab.label}
      </button>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-8">
      {/* 좌측: 사용자 카드 + 탭 내비 */}
      <aside className="flex flex-col gap-4">
        <div className="rounded-lg border border-black/[0.0627] bg-[#f7f8f9] px-4 py-3.5 dark:border-white/10 dark:bg-slate-800">
          {subline && (
            <p className="text-xs text-slate-500 dark:text-slate-400">{subline}</p>
          )}
          <p className="mt-1 text-base font-bold text-slate-900 dark:text-white">
            {user.name || '이름 미등록'}
          </p>
          <div className="mt-0.5 flex flex-col gap-0.5 text-sm text-slate-600 dark:text-slate-300">
            {user.email && <span>{user.email}</span>}
            {user.phone && <span>{user.phone}</span>}
          </div>
        </div>

        <nav className="flex gap-1 overflow-x-auto lg:flex-col lg:gap-0.5">
          {mainTabs.map((tab) => (
            <NavButton key={tab.key} tab={tab} />
          ))}
          {footerTabs.length > 0 && (
            <>
              {/* 데스크톱에서만 하단 분리 (모바일은 가로 스크롤로 이어붙임) */}
              <div className="hidden lg:mt-2 lg:block lg:border-t lg:border-slate-200 lg:pt-2 lg:dark:border-slate-800" />
              {footerTabs.map((tab) => (
                <NavButton key={tab.key} tab={tab} />
              ))}
            </>
          )}
        </nav>
      </aside>

      {/* 콘텐츠 — 컨텐츠 박스(Card) 그림자 제거(평평한 디자인) */}
      <div className="min-w-0 [&_.shadow-sm]:shadow-none">
        {tabs.map((tab) => (
          <div
            key={tab.key}
            className={
              tab.key === active ? 'flex flex-col gap-6' : 'hidden'
            }
          >
            {tab.node}
          </div>
        ))}
      </div>
    </div>
  );
}
