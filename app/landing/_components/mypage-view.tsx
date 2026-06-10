'use client';

/**
 * MypageView — 마이페이지 시안 (좌측 사이드바 + 3개 탭).
 *
 * 탭:
 *   ① 내 정보   — 이메일/이름/연락처(편집) · 호텔명/직책(읽기전용)
 *   ② 비밀번호 변경 — 현재/새/확인
 *   ③ 직원 관리 — 직원 목록 테이블(모바일 카드뷰) + 직원 추가
 *
 * 색상 토큰: brand #00A36B · text #1A1C20 / #555D6D / #868B94
 *   input border #DCDEE3 · disabled bg #F3F4F5 · 필수 #FA342C · card bg #F7F8F9
 *
 * 시안용으로 실제 저장 API에는 미연결 상태.
 */

import { useState } from 'react';
import { ChevronDown, ChevronRight, Plus, X } from 'lucide-react';

type Tab = 'profile' | 'password' | 'staff';
type Staff = (typeof STAFF)[number];
const ROLES = ['담당자', '관리자', '매니저'];

const NAV: { key: Tab; label: string }[] = [
  { key: 'profile', label: '내 정보' },
  { key: 'password', label: '비밀번호 변경' },
  { key: 'staff', label: '직원 관리' },
];

const STAFF = [
  { id: 1, name: '김오아', role: '관리자', email: 'as@oapms.com', phone: '010-1234-5678', active: true },
  { id: 2, name: '김오아', role: '매니저', email: 'as@oapms.com', phone: '010-1234-5678', active: true },
  { id: 3, name: '김오아', role: '매니저', email: 'as@oapms.com', phone: '010-1234-5678', active: false },
];

function Required() {
  return <span className="text-[#FA342C]">*</span>;
}

const inputCls =
  'h-[52px] w-full rounded-lg border border-[#DCDEE3] px-4 text-base text-[#1A1C20] placeholder:text-[#B0B3BA] focus:border-[#00A36B] focus:outline-none';
const disabledInputCls =
  'h-[52px] w-full cursor-not-allowed rounded-lg border border-[#DCDEE3] bg-[#F3F4F5] px-4 text-base text-[#868B94]';
const labelCls = 'flex items-center gap-0.5 text-sm font-medium text-[#1A1C20]';
const helperCls = 'text-sm text-[#868B94]';

export function MypageView() {
  const [tab, setTab] = useState<Tab>('profile');

  return (
    <div className="mx-auto w-full max-w-[1200px]">
      <h1 className="mb-8 text-3xl font-bold text-[#1A1C20]">마이페이지</h1>

      <div className="flex flex-col gap-8 lg:flex-row lg:gap-12">
        {/* 좌측 사이드바 */}
        <aside className="flex shrink-0 flex-col gap-4 lg:w-[260px]">
          <div className="flex flex-col gap-1 rounded-xl bg-[#F7F8F9] p-5">
            <span className="text-xs text-[#868B94]">오아호텔 · 관리자</span>
            <span className="text-lg font-bold text-[#1A1C20]">김오아</span>
            <span className="text-sm text-[#868B94]">as@oapms.com</span>
          </div>

          <nav className="flex flex-col overflow-hidden rounded-xl border border-black/[0.06]">
            {NAV.map((item, i) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setTab(item.key)}
                className={`px-5 py-3.5 text-left text-sm transition-colors ${
                  i > 0 ? 'border-t border-black/[0.06]' : ''
                } ${
                  tab === item.key
                    ? 'font-bold text-[#00A36B]'
                    : 'font-medium text-[#1A1C20] hover:bg-[#F7F8F9]'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* 우측 본문 */}
        <div className="min-w-0 flex-1">
          {tab === 'profile' && <ProfileTab />}
          {tab === 'password' && <PasswordTab />}
          {tab === 'staff' && <StaffTab />}
        </div>
      </div>
    </div>
  );
}

function ProfileTab() {
  return (
    <div className="flex max-w-[436px] flex-col gap-5">
      <h2 className="text-xl font-bold text-[#1A1C20]">내 정보</h2>

      <Field label={<>이메일 <Required /></>}>
        <input type="email" defaultValue="as@oapms.com" className={inputCls} />
      </Field>

      <Field label={<>이름 <Required /></>}>
        <input type="text" defaultValue="김오아" className={inputCls} />
      </Field>

      <Field label="연락처">
        <input type="tel" placeholder="010123456" className={inputCls} />
      </Field>

      <Field label="호텔명" helper="호텔명 수정이 필요한 경우 담당자에게 문의해 주세요">
        <input type="text" value="오아호텔" disabled className={disabledInputCls} />
      </Field>

      <Field label="직책" helper="직책 변경은 직원 관리에서 가능합니다">
        <div className="relative">
          <input type="text" value="관리자" disabled className={`${disabledInputCls} pr-10`} />
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#B0B3BA]" />
        </div>
      </Field>

      <button
        type="button"
        className="mt-1 w-fit rounded-lg bg-[#00A36B] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#008A59]"
      >
        수정
      </button>
    </div>
  );
}

function PasswordTab() {
  return (
    <div className="flex max-w-[436px] flex-col gap-5">
      <h2 className="text-xl font-bold text-[#1A1C20]">비밀번호 변경</h2>

      <Field label={<>현재 비밀번호 <Required /></>}>
        <input
          type="password"
          autoComplete="current-password"
          placeholder="비밀번호를 입력해 주세요"
          className={inputCls}
        />
      </Field>

      <Field label={<>새 비밀번호 <Required /></>}>
        <input
          type="password"
          autoComplete="new-password"
          placeholder="새 비밀번호 입력해 주세요"
          className={inputCls}
        />
      </Field>

      <Field label={<>새 비밀번호 확인 <Required /></>}>
        <input
          type="password"
          autoComplete="new-password"
          placeholder="새 비밀번호를 다시 입력해 주세요"
          className={inputCls}
        />
      </Field>

      <button
        type="button"
        className="mt-1 w-fit rounded-lg bg-[#00A36B] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#008A59]"
      >
        변경
      </button>
    </div>
  );
}

function StaffTab() {
  const [editing, setEditing] = useState<Staff | null>(null);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-[#1A1C20]">직원관리</h2>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#00A36B] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#008A59]"
        >
          <Plus className="h-4 w-4" />
          직원 추가
        </button>
      </div>

      {/* 데스크톱 테이블 */}
      <div className="hidden overflow-hidden rounded-xl border border-black/[0.06] sm:block">
        <table className="w-full">
          <thead>
            <tr className="border-b border-black/[0.06] text-left text-sm text-[#868B94]">
              <th className="px-5 py-3 font-medium">이름</th>
              <th className="px-5 py-3 font-medium">직책</th>
              <th className="px-5 py-3 font-medium">이메일</th>
              <th className="px-5 py-3 font-medium">연락처</th>
              <th className="px-5 py-3 font-medium">상태</th>
              <th className="w-10 px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {STAFF.map((s) => (
              <tr
                key={s.id}
                onClick={() => setEditing(s)}
                className={`cursor-pointer border-b border-black/[0.06] text-sm transition-colors last:border-b-0 hover:bg-[#F7F8F9] ${
                  s.active ? 'text-[#1A1C20]' : 'text-[#B0B3BA]'
                }`}
              >
                <td className="px-5 py-4">{s.name}</td>
                <td className="px-5 py-4">{s.role}</td>
                <td className="px-5 py-4">{s.email}</td>
                <td className="px-5 py-4">{s.phone}</td>
                <td className="px-5 py-4">
                  <span className={s.active ? 'font-medium text-[#00A36B]' : 'text-[#B0B3BA]'}>
                    {s.active ? '활성화' : '비활성화'}
                  </span>
                </td>
                <td className="px-5 py-4 text-right">
                  <ChevronRight className="ml-auto h-4 w-4 text-[#B0B3BA]" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 모바일 카드뷰 */}
      <ul className="flex flex-col gap-3 sm:hidden">
        {STAFF.map((s) => (
          <li
            key={s.id}
            onClick={() => setEditing(s)}
            className={`flex cursor-pointer items-center justify-between rounded-xl border border-black/[0.06] p-4 ${
              s.active ? '' : 'opacity-50'
            }`}
          >
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <span className="text-base font-semibold text-[#1A1C20]">{s.name}</span>
                <span className="text-xs text-[#555D6D]">{s.role}</span>
              </div>
              <span className="text-sm text-[#555D6D]">{s.email}</span>
              <span className="text-sm text-[#868B94]">{s.phone}</span>
              <span
                className={`mt-1 text-xs font-medium ${s.active ? 'text-[#00A36B]' : 'text-[#B0B3BA]'}`}
              >
                {s.active ? '활성화' : '비활성화'}
              </span>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-[#B0B3BA]" />
          </li>
        ))}
      </ul>

      {editing && <StaffEditModal staff={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function StaffEditModal({ staff, onClose }: { staff: Staff; onClose: () => void }) {
  const [roleOpen, setRoleOpen] = useState(false);
  const [role, setRole] = useState(staff.role);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
      onClick={onClose}
    >
      <div
        className="relative flex w-full max-w-[420px] flex-col gap-6 rounded-2xl bg-white p-8 shadow-[0px_2px_10px_0px_rgba(0,0,0,0.1)]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="absolute right-5 top-5 text-[#868B94] transition-colors hover:text-[#1A1C20]"
        >
          <X className="h-5 w-5" />
        </button>

        <h3 className="text-center text-xl font-bold text-[#1A1C20]">직원정보 수정</h3>

        <div className="flex flex-col gap-2 px-0.5">
          <span className={labelCls}>이름</span>
          <input type="text" defaultValue={staff.name} className={inputCls} />
        </div>

        {/* 직책 — 드롭다운 */}
        <div className="relative flex flex-col gap-2 px-0.5">
          <span className={labelCls}>직책</span>
          <button
            type="button"
            onClick={() => setRoleOpen((v) => !v)}
            aria-expanded={roleOpen}
            className={`flex h-[52px] w-full items-center justify-between rounded-lg border px-4 text-left text-base text-[#1A1C20] transition-colors ${
              roleOpen ? 'border-[#00A36B]' : 'border-[#DCDEE3]'
            }`}
          >
            {role}
            <ChevronDown
              className={`h-5 w-5 text-[#868B94] transition-transform ${roleOpen ? 'rotate-180' : ''}`}
            />
          </button>
          {roleOpen && (
            <ul className="absolute left-0 right-0 top-[calc(100%+4px)] z-10 overflow-hidden rounded-lg border border-[#DCDEE3] bg-white py-1 shadow-[0px_2px_10px_0px_rgba(0,0,0,0.1)]">
              {ROLES.filter((r) => r !== role).map((r) => (
                <li key={r}>
                  <button
                    type="button"
                    onClick={() => {
                      setRole(r);
                      setRoleOpen(false);
                    }}
                    className="w-full px-4 py-2.5 text-left text-base text-[#1A1C20] transition-colors hover:bg-[#F7F8F9]"
                  >
                    {r}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-col gap-2 px-0.5">
          <span className={labelCls}>연락처</span>
          <input type="tel" defaultValue="01012345678" className={inputCls} />
        </div>

        <div className="mt-1 flex items-center gap-3">
          <button
            type="button"
            className="flex-1 rounded-lg bg-[#FDF0F0] py-3.5 text-base font-semibold text-[#FA342C] transition-colors hover:bg-[#fbe2e2]"
          >
            계정 비활성화
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg bg-[#F3F4F5] py-3.5 text-base font-semibold text-[#1A1C20] transition-colors hover:bg-[#e9eaec]"
          >
            수정하기
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  helper,
  children,
}: {
  label: React.ReactNode;
  helper?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className={labelCls}>{label}</span>
      {children}
      {helper && <span className={helperCls}>{helper}</span>}
    </div>
  );
}
