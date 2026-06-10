'use client';

/**
 * ProfileTabsShell — 마이페이지 좌측 탭 내비 셸 (시안 스타일, 2026-06-10).
 *
 * 탭: 내 정보 / 비밀번호 변경 / 직원 관리.
 * 각 탭 콘텐츠(실제 폼)는 서버에서 렌더해 ReactNode로 주입받는다.
 * 전역 RoleScope 크롬 안에서 brand-* 토큰 사용.
 */

import { useState } from 'react';
import { User, KeyRound, Users } from 'lucide-react';
import type { ReactNode } from 'react';

type Tab = 'profile' | 'password' | 'staff';

const NAV: { key: Tab; label: string; Icon: typeof User }[] = [
  { key: 'profile', label: '내 정보', Icon: User },
  { key: 'password', label: '비밀번호 변경', Icon: KeyRound },
  { key: 'staff', label: '직원 관리', Icon: Users },
];

type UserCard = {
  name: string;
  email: string;
  phone: string;
  hotelName: string;
  title: string;
};

export function ProfileTabsShell({
  user,
  profile,
  password,
  staff,
}: {
  user: UserCard;
  profile: ReactNode;
  password: ReactNode;
  staff: ReactNode;
}) {
  const [tab, setTab] = useState<Tab>('profile');

  const subline = [user.hotelName, user.title].filter(Boolean).join(' · ');

  return (
    <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-8">
      {/* 좌측: 사용자 카드 + 탭 내비 */}
      <aside className="flex flex-col gap-4">
        {/* 사용자 요약 카드 */}
        <div className="rounded-xl bg-slate-200/70 px-4 py-3.5 dark:bg-slate-800">
          {subline && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {subline}
            </p>
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
          {NAV.map(({ key, label, Icon }) => {
            const active = key === tab;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`flex shrink-0 items-center gap-2.5 rounded-lg px-4 py-2.5 text-left text-sm font-medium transition-colors ${
                  active
                    ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* 콘텐츠 */}
      <div className="min-w-0">
        <div className={tab === 'profile' ? 'flex flex-col gap-6' : 'hidden'}>
          {profile}
        </div>
        <div className={tab === 'password' ? 'block' : 'hidden'}>{password}</div>
        <div className={tab === 'staff' ? 'block' : 'hidden'}>{staff}</div>
      </div>
    </div>
  );
}
