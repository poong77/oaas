'use client';

/**
 * HomeView — Figma "로그인 후" 통합 홈 시안 (node 22:9945).
 *
 * 섹션 구성:
 *   ① Header  — 로고 · 카테고리 찾아보기(메가메뉴) · 내비 · 운영중 배지 · 호텔/유저 드롭다운 (sticky)
 *   ② Hero    — "무엇을 도와드릴까요?" + 검색창 + 인기 키워드
 *   ③ 공지사항 — 최근 3건 (공지/서비스장애/릴리즈 컬러 배지)
 *   ④ 고객센터 — 전화/상담시간/이메일·팩스/긴급장애 + 원격지원
 *   ⑤ 내 문의 — 상태 요약(접수/처리중/답변완료) + 문의하기 + 최근 문의 리스트
 *   ⑥ Footer  — 공용 푸터
 *
 * 색상 토큰 (Figma 추출):
 *   brand #00A36B · text #1A1C20 / #555D6D / #868B94 · bg #F7F8F9
 *   공지 #EFF6FF/#217CF9 · 서비스장애 #FDF0F0/#FA342C · 릴리즈 #F5F3FE/#8969EA · 완료 #E6F7F0/#00A36B
 *
 * 로그인 후 전용 시안이므로 자체 헤더를 가진다(RoleScope 크롬 제외 — proxy + role-scope 처리).
 */

import { useState } from 'react';
import Link from 'next/link';
import {
  Search,
  ArrowRight,
  ChevronDown,
  Monitor,
  Bell,
  Briefcase,
  BedDouble,
  ShieldCheck,
  Sparkles,
  Building2,
  Globe,
  Layers,
  KeyRound,
  LayoutGrid,
  User,
  FileText,
  LogOut,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { LandingFooter } from './landing-footer';

const PRODUCTS: { key: string; label: string; Icon: LucideIcon }[] = [
  { key: 'pms', label: 'PMS', Icon: Building2 },
  { key: 'web', label: '홈페이지', Icon: Globe },
  { key: 'cms', label: 'CMS', Icon: Layers },
  { key: 'keyless', label: 'Keyless', Icon: KeyRound },
  { key: 'kiosk', label: 'Kiosk', Icon: Monitor },
  { key: 'etc', label: '기타', Icon: LayoutGrid },
];

const ROLES: { key: string; label: string; Icon: LucideIcon }[] = [
  { key: 'front', label: '프론트', Icon: Bell },
  { key: 'sales', label: '예약판매', Icon: Briefcase },
  { key: 'house', label: '하우스키핑', Icon: BedDouble },
  { key: 'manager', label: '관리자', Icon: ShieldCheck },
  { key: 'open', label: '신규오픈', Icon: Sparkles },
];

const NAV = [
  { label: '가이드북', href: '/landing/home#category' },
  { label: '문의하기', href: '/tickets/new' },
  { label: '문의내역', href: '/landing/tickets' },
  { label: '공지사항', href: '/landing/home#notice' },
];

const POPULAR_KEYWORDS = [
  'PMS 속도가 느려요',
  '객실추가',
  '계정찾기',
  '오버부킹',
  '객실요금설정',
];

const NOTICES: { id: number; type: keyof typeof NOTICE_BADGE; title: string; date: string }[] = [
  { id: 1, type: 'notice', title: '2026년 6월 3일 지방선거일 휴무 안내', date: '2026-01-03' },
  { id: 2, type: 'incident', title: '아고다 장애 관련 안내', date: '2026-01-03' },
  { id: 3, type: 'release', title: 'v1.1.0 릴리즈 노트 — 이슈 클레임 UX 개선', date: '2026-01-03' },
];

const NOTICE_BADGE = {
  notice: { label: '공지사항', cls: 'bg-[#EFF6FF] text-[#217CF9]' },
  incident: { label: '서비스 장애', cls: 'bg-[#FDF0F0] text-[#FA342C]' },
  release: { label: '릴리즈', cls: 'bg-[#F5F3FE] text-[#8969EA]' },
} as const;

const TICKET_STATUS = {
  received: { label: '접수', cls: 'border-[#217CF9] bg-[#EFF6FF] text-[#217CF9]' },
  progress: { label: '처리중', cls: 'border-[#8969EA] bg-[#F5F3FE] text-[#8969EA]' },
  done: { label: '답변 완료', cls: 'border-[#008A59] bg-[#E6F7F0] text-[#00A36B]' },
} as const;

const MY_TICKETS: { id: number; status: keyof typeof TICKET_STATUS; title: string; meta: string; date: string }[] = [
  { id: 1, status: 'received', title: '일마감이 안돼요', meta: 'PMS · 기능오류', date: '2026-01-03' },
  { id: 2, status: 'progress', title: '일마감이 안돼요', meta: 'PMS · 기능오류', date: '2026-01-03' },
  { id: 3, status: 'done', title: '일마감이 안돼요', meta: 'PMS · 기능오류', date: '2026-01-03' },
];

const USER_MENU = [
  { label: '마이페이지', href: '/landing/home', Icon: User },
  { label: '문의 내역', href: '/landing/tickets', Icon: FileText },
  { label: '로그아웃', href: '/login', Icon: LogOut },
];

export function HomeView({ hotelName = '오아호텔' }: { hotelName?: string }) {
  const [tab, setTab] = useState<'product' | 'role'>('product');
  const [userOpen, setUserOpen] = useState(false);

  const closeAll = () => setUserOpen(false);

  return (
    <div className="min-h-screen bg-white font-sans text-[#1A1C20]">
      {/* ① Header */}
      <header className="sticky top-0 z-50 border-b border-black/5 bg-white">
        <div className="mx-auto flex h-[68px] max-w-[1200px] items-center justify-between px-5">
          <Link href="/landing/home" className="flex items-center" onClick={closeAll}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/landing/logo-header.svg" alt="OA서포트" className="h-5 w-auto" />
          </Link>

          <nav className="flex items-center gap-3 sm:gap-6">
            <div className="hidden items-center gap-6 lg:flex">
              {NAV.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="text-sm font-medium text-[#1A1C20] hover:text-[#00A36B]"
                  onClick={closeAll}
                >
                  {item.label}
                </Link>
              ))}
            </div>

            <span className="hidden items-center gap-1.5 rounded-full bg-[#E6F7F0] px-2.5 py-1 sm:inline-flex">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#008A59] opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#008A59]" />
              </span>
              <span className="text-xs font-semibold text-[#008A59]">운영 중</span>
            </span>

            {/* 호텔 / 유저 드롭다운 */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setUserOpen((v) => !v)}
                className="flex items-center gap-1.5 rounded-lg border border-black/[0.06] px-4 py-2 text-sm font-medium text-[#1A1C20] transition-colors hover:bg-[#F7F8F9]"
                aria-expanded={userOpen}
              >
                {hotelName}
                <ChevronDown
                  className={`h-4 w-4 text-[#868B94] transition-transform ${userOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {userOpen && (
                <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-44 overflow-hidden rounded-xl border border-black/[0.06] bg-white py-1.5 shadow-[0px_8px_24px_0px_rgba(0,0,0,0.12)]">
                  {USER_MENU.map(({ label, href, Icon }) => (
                    <Link
                      key={label}
                      href={href}
                      onClick={closeAll}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-[#1A1C20] transition-colors hover:bg-[#F7F8F9]"
                    >
                      <Icon className="h-4 w-4 text-[#868B94]" />
                      {label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </nav>
        </div>
      </header>

      {/* 드롭다운 백드롭 (클릭 시 닫힘) */}
      {userOpen && (
        <button
          type="button"
          aria-label="메뉴 닫기"
          onClick={closeAll}
          className="fixed inset-0 z-40 cursor-default"
        />
      )}

      {/* ② Hero */}
      <section className="px-5 py-16 sm:py-24">
        <div className="mx-auto flex max-w-[694px] flex-col gap-6">
          <h1 className="text-center text-3xl font-bold tracking-tight sm:text-[36px]">
            무엇을 도와드릴까요?
          </h1>
          <div className="flex flex-col items-center gap-3">
            <label className="flex w-full items-center gap-3 rounded-xl border border-[#DCDEE3] bg-white py-4 pl-6 pr-8 transition-colors focus-within:border-[#00A36B]">
              <Search className="h-5 w-5 shrink-0 text-[#868B94]" />
              <input
                type="search"
                placeholder="궁금한 키워드를 검색해 보세요"
                className="w-full bg-transparent text-base text-[#1A1C20] placeholder:text-[#B0B3BA] focus:outline-none"
              />
            </label>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 self-start px-1">
              {POPULAR_KEYWORDS.map((kw) => (
                <button
                  key={kw}
                  type="button"
                  className="text-sm text-[#555D6D] transition-colors hover:text-[#00A36B]"
                >
                  #&nbsp;{kw}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ③ 카테고리 찾아보기 */}
      <section id="category" className="scroll-mt-[68px] bg-[#F7F8F9] px-5 py-16">
        <div className="mx-auto flex max-w-[1205px] flex-col items-center gap-7">
          <h2 className="text-center text-[28px] font-bold sm:text-[32px]">카테고리 찾아보기</h2>

          {/* 탭 토글 */}
          <div className="flex w-[327px] max-w-full items-center rounded-xl bg-black/5 p-1">
            <button
              type="button"
              onClick={() => setTab('product')}
              className={`flex-1 rounded-lg px-2 py-2 text-base font-semibold transition-colors ${
                tab === 'product'
                  ? 'bg-white text-[#1A1C20] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.09)]'
                  : 'text-[#555D6D]'
              }`}
            >
              제품별
            </button>
            <button
              type="button"
              onClick={() => setTab('role')}
              className={`flex-1 rounded-lg px-2 py-2 text-base font-semibold transition-colors ${
                tab === 'role'
                  ? 'bg-white text-[#1A1C20] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.09)]'
                  : 'text-[#555D6D]'
              }`}
            >
              역할별
            </button>
          </div>

          {/* 카드 그리드 — 탭에 따라 칸 수 분기 */}
          <div
            className={`grid w-full grid-cols-2 gap-3 sm:grid-cols-3 ${
              tab === 'product' ? 'lg:grid-cols-6' : 'lg:grid-cols-5'
            }`}
          >
            {(tab === 'product' ? PRODUCTS : ROLES).map(({ key, label, Icon }) => (
              <Link
                key={key}
                href="/landing/help"
                className="flex flex-col items-center justify-center gap-4 rounded-xl border border-black/[0.04] bg-white px-4 py-6 transition-shadow hover:shadow-md"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#E6F7F0]">
                  <Icon className="h-6 w-6 text-[#00A36B]" />
                </span>
                <span className="whitespace-nowrap text-base font-semibold text-[#1A1C20]">
                  {label}
                </span>
              </Link>
            ))}
          </div>

          <Link
            href="/landing/help"
            className="flex items-center gap-1 text-sm font-medium text-[#555D6D] hover:text-[#00A36B]"
          >
            가이드 전체보기
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* ④ 내 문의 */}
      <section id="my-tickets" className="px-5 py-16">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">내 문의</h2>
            <Link
              href="/landing/tickets"
              className="flex items-center gap-1 text-sm font-medium text-[#555D6D] hover:text-[#00A36B]"
            >
              내 문의 전체보기
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
            {/* 좌측 — 상태 요약 카드 + 문의하기 */}
            <div className="flex shrink-0 flex-col gap-5 rounded-xl border border-black/[0.06] bg-white p-5 shadow-[0px_1px_4px_0px_rgba(0,0,0,0.08)] lg:w-[320px]">
              <div className="flex items-center gap-3">
                {(
                  [
                    { label: '접수', count: 1, dot: false },
                    { label: '처리중', count: 1, dot: true },
                    { label: '답변완료', count: 5, dot: false },
                  ] as const
                ).map((s) => (
                  <div key={s.label} className="flex flex-1 flex-col items-center gap-2">
                    <span className="relative text-sm text-[#1A1C20]">
                      {s.label}
                      {s.dot && (
                        <span className="absolute -right-2 -top-0.5 h-1.5 w-1.5 rounded-full bg-[#FA342C]" />
                      )}
                    </span>
                    <span className="text-xl font-medium text-[#1A1C20]">{s.count}</span>
                  </div>
                ))}
              </div>
              <Link
                href="/landing/inquiry"
                className="flex items-center justify-center rounded-lg bg-[#00A36B] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#008A59]"
              >
                문의하기
              </Link>
            </div>

            {/* 우측 — 문의 리스트 */}
            <ul className="flex-1 border-t border-black/[0.06]">
              {MY_TICKETS.map((t) => {
                const status = TICKET_STATUS[t.status];
                return (
                  <li key={t.id} className="border-b border-black/[0.06]">
                    <Link
                      href="/landing/tickets"
                      className="flex flex-col gap-2 px-2 py-6 transition-colors hover:bg-[#F7F8F9] sm:flex-row sm:items-center sm:gap-5"
                    >
                      <span
                        className={`inline-flex w-fit shrink-0 items-center justify-center rounded-full border px-3 py-0.5 text-xs font-medium ${status.cls}`}
                      >
                        {status.label}
                      </span>
                      <span className="flex flex-1 flex-col gap-0.5">
                        <span className="text-base font-semibold text-[#1A1C20]">{t.title}</span>
                        <span className="text-xs text-[#555D6D]">{t.meta}</span>
                      </span>
                      <span className="text-sm text-[#868B94]">{t.date}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </section>

      {/* ⑤ 공지사항 */}
      <section id="notice" className="px-5 py-12">
        <div className="mx-auto max-w-[1200px]">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-bold">공지사항</h2>
            <Link
              href="/landing/notices"
              className="flex items-center gap-1 text-sm font-medium text-[#555D6D] hover:text-[#00A36B]"
            >
              공지사항 전체보기
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <ul className="border-t border-black/[0.06]">
            {NOTICES.map((n) => {
              const badge = NOTICE_BADGE[n.type];
              return (
                <li key={n.id} className="border-b border-black/[0.06]">
                  <Link
                    href="/landing/notices"
                    className="flex flex-col gap-2 px-2 py-6 transition-colors hover:bg-[#F7F8F9] sm:flex-row sm:items-center sm:gap-5"
                  >
                    <span
                      className={`inline-flex w-fit items-center rounded-md px-2 py-0.5 text-xs font-medium ${badge.cls}`}
                    >
                      {badge.label}
                    </span>
                    <span className="flex-1 text-base font-medium text-[#1A1C20]">{n.title}</span>
                    <span className="text-sm text-[#868B94]">{n.date}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* ⑥ 고객센터 */}
      <section id="contact" className="bg-[#F7F8F9] px-5 py-16">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-6">
          <h2 className="text-2xl font-bold">고객센터</h2>

          <div className="flex flex-col gap-3 lg:flex-row">
            <div className="flex flex-col gap-3 rounded-lg bg-white p-6 lg:flex-[1.6]">
              <span className="text-base font-semibold text-[#1A1C20]">고객센터</span>
              <span className="text-2xl font-bold text-[#00A36B]">1833-4702</span>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[#1A1C20]">
                <span><b className="font-semibold">1번</b> 시스템 사용 문의</span>
                <span className="text-[#868B94]">·</span>
                <span><b className="font-semibold">2번</b> 도입 상담</span>
                <span className="text-[#868B94]">·</span>
                <span><b className="font-semibold">3번</b> 경영·회계 기타</span>
              </div>
            </div>

            <div className="flex flex-col gap-3 rounded-lg bg-white p-6 lg:flex-1">
              <span className="text-base font-semibold text-[#1A1C20]">상담시간</span>
              <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                <span className="text-[#1A1C20]">평일</span>
                <span className="text-[#555D6D]">10:00~18:40</span>
                <span className="text-[#1A1C20]">점심시간</span>
                <span className="text-[#555D6D]">12:00~13:00</span>
              </div>
            </div>

            <div className="flex flex-col gap-3 rounded-lg bg-white p-6 lg:flex-1">
              <span className="text-base font-semibold text-[#1A1C20]">이메일 및 팩스</span>
              <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                <span className="text-[#1A1C20]">이메일</span>
                <span className="text-[#555D6D]">as@oapms.com</span>
                <span className="text-[#1A1C20]">팩스</span>
                <span className="text-[#555D6D]">0505-300-4702</span>
              </div>
            </div>

            <div className="flex flex-col gap-3 rounded-lg bg-white p-6 lg:flex-1">
              <span className="text-base font-semibold text-[#1A1C20]">
                야간/휴일 <span className="text-[#FA342C]">긴급 장애 신고</span>
              </span>
              <span className="text-xl font-bold text-[#1A1C20]">070-8028-0919</span>
              <p className="text-xs text-[#555D6D]">단순 금액 정정 불가</p>
            </div>
          </div>

          <div className="flex flex-col items-start justify-between gap-4 rounded-lg bg-white p-6 sm:flex-row sm:items-center">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Monitor className="h-5 w-5 text-[#00A36B]" />
                <span className="text-base font-semibold text-[#1A1C20]">PC 원격 연결 서비스</span>
              </div>
              <p className="text-sm text-[#555D6D]">
                원활한 문제 해결이 필요하신가요? 파트너의 안내에 따라 원격지원 연결하기 버튼을 눌러주세요.
              </p>
            </div>
            <button
              type="button"
              className="shrink-0 rounded-lg bg-[#E6F7F0] px-5 py-2.5 text-sm font-medium text-[#00A36B] transition-colors hover:bg-[#d2f0e4]"
            >
              원격지원 연결하기
            </button>
          </div>
        </div>
      </section>

      {/* ⑥ Footer */}
      <LandingFooter />
    </div>
  );
}
