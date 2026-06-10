'use client';

/**
 * LandingView — Figma "로그인 전" 통합 홈 시안.
 *
 * 섹션 구성 (Figma node 1:16):
 *   ① Header  — 로고 · 내비 · 운영중 배지 · 로그인 버튼 (sticky)
 *   ② Hero    — "무엇을 도와드릴까요?" + 검색창 + 인기 키워드
 *   ③ 카테고리 찾아보기 — 제품별/역할별 탭 + 카드 그리드
 *   ④ 공지사항 — 최근 3건 리스트
 *   ⑤ CTA     — 문제 미해결 안내 + 문의하기
 *   ⑥ 고객센터 — 전화/상담시간/이메일·팩스/긴급장애 + 원격지원
 *   ⑦ Footer  — 패밀리 링크 3카드 + 약관 + 카피라이트
 *
 * 색상 토큰 (Figma 추출):
 *   brand #00A36B · text #1A1C20 / #555D6D · bg #F7F8F9 · footer #2A3038
 *   notice badge #EFF6FF/#217CF9 · status #E6F7F0/#008A59
 */

import { useState } from 'react';
import Link from 'next/link';
import {
  Search,
  ArrowRight,
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
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { LandingHeader } from './landing-header';
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
  { key: 'sales', label: '예약·판매', Icon: Briefcase },
  { key: 'house', label: '하우스키핑', Icon: BedDouble },
  { key: 'manager', label: '관리자', Icon: ShieldCheck },
  { key: 'open', label: '신규 오픈', Icon: Sparkles },
];

const POPULAR_KEYWORDS = [
  'PMS 속도가 느려요',
  '객실추가',
  '계정찾기',
  '오버부킹',
  '객실요금설정',
];

const NOTICES = [
  { id: 1, title: '2026년 6월 3일 지방선거일 휴무 안내', date: '2026-01-03' },
  { id: 2, title: '신규 기능 출시 — Self-Search 통합 검색 안내', date: '2026-01-03' },
  { id: 3, title: '2026년 5월 25일 대체휴일 휴무 안내', date: '2026-01-03' },
];

export function LandingView() {
  const [tab, setTab] = useState<'product' | 'role'>('product');

  return (
    <div className="min-h-screen bg-white font-sans text-[#1A1C20]">
      {/* ① Header */}
      <LandingHeader variant="public" />

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
      <section id="category" className="bg-[#F7F8F9] px-5 py-16">
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

          {/* 카드 그리드 — 탭에 따라 레이아웃 분기 */}
          {tab === 'product' ? (
            <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {PRODUCTS.map(({ key, label, Icon }) => (
                <Link
                  key={key}
                  href="/landing/help"
                  className="flex flex-col items-center justify-center gap-4 rounded-xl border border-black/[0.04] bg-white px-4 py-6 transition-shadow hover:shadow-md"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#E6F7F0]">
                    <Icon className="h-6 w-6 text-[#00A36B]" />
                  </span>
                  <span className="text-base font-semibold text-[#1A1C20]">{label}</span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {ROLES.map(({ key, label, Icon }) => (
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
          )}

          <Link
            href="/landing/help"
            className="flex items-center gap-1 text-sm font-medium text-[#555D6D] hover:text-[#00A36B]"
          >
            가이드 전체보기
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* ④ 공지사항 */}
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
            {NOTICES.map((n) => (
              <li key={n.id} className="border-b border-black/[0.06]">
                <Link
                  href="/landing/notices"
                  className="flex flex-col gap-2 px-2 py-6 transition-colors hover:bg-[#F7F8F9] sm:flex-row sm:items-center sm:gap-5"
                >
                  <span className="inline-flex w-fit items-center rounded-md bg-[#EFF6FF] px-2 py-0.5 text-xs font-medium text-[#217CF9]">
                    공지사항
                  </span>
                  <span className="flex-1 text-base font-medium text-[#1A1C20]">{n.title}</span>
                  <span className="text-sm text-[#868B94]">{n.date}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ⑤ CTA */}
      <section id="cta" className="px-5 pb-12">
        <div className="mx-auto flex max-w-[1200px] flex-col items-start justify-between gap-6 rounded-xl bg-[#E6F7F0] p-8 sm:flex-row sm:items-center sm:p-10">
          <div className="flex flex-col gap-2">
            <h3 className="text-2xl font-bold text-[#1A1C20]">
              도움말을 통해 문제를 해결하지 못하셨나요?
            </h3>
            <p className="text-sm text-[#555D6D]">궁금한 사항을 문의주시면 성실하게 답변드립니다.</p>
            <p className="text-sm text-[#555D6D]">
              10:00~18:40&nbsp;(점심시간 12:00~13:00ㅣ주말 · 공휴일 휴무)
            </p>
          </div>
          <Link
            href="/landing/inquiry"
            className="shrink-0 rounded-lg bg-[#00A36B] px-6 py-3.5 text-base font-semibold text-white transition-colors hover:bg-[#008A59]"
          >
            문의하기
          </Link>
        </div>
      </section>

      {/* ⑥ 고객센터 */}
      <section id="contact" className="bg-[#F7F8F9] px-5 py-16">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-6">
          <h2 className="text-2xl font-bold">고객센터</h2>

          <div className="flex flex-col gap-3 lg:flex-row">
            {/* 고객센터 전화 — 가장 넓게 */}
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

            {/* 상담시간 */}
            <div className="flex flex-col gap-3 rounded-lg bg-white p-6 lg:flex-1">
              <span className="text-base font-semibold text-[#1A1C20]">상담시간</span>
              <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                <span className="text-[#1A1C20]">평일</span>
                <span className="text-[#555D6D]">10:00~18:40</span>
                <span className="text-[#1A1C20]">점심시간</span>
                <span className="text-[#555D6D]">12:00~13:00</span>
              </div>
            </div>

            {/* 이메일 및 팩스 */}
            <div className="flex flex-col gap-3 rounded-lg bg-white p-6 lg:flex-1">
              <span className="text-base font-semibold text-[#1A1C20]">이메일 및 팩스</span>
              <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                <span className="text-[#1A1C20]">이메일</span>
                <span className="text-[#555D6D]">as@oapms.com</span>
                <span className="text-[#1A1C20]">팩스</span>
                <span className="text-[#555D6D]">0505-300-4702</span>
              </div>
            </div>

            {/* 야간/휴일 긴급 장애 신고 */}
            <div className="flex flex-col gap-3 rounded-lg bg-white p-6 lg:flex-1">
              <span className="text-base font-semibold text-[#1A1C20]">
                야간/휴일 <span className="text-[#FA342C]">긴급 장애 신고</span>
              </span>
              <span className="text-xl font-bold text-[#1A1C20]">070-8028-0919</span>
              <p className="text-xs text-[#555D6D]">단순 금액 정정 불가</p>
            </div>
          </div>

          {/* PC 원격 연결 서비스 */}
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

      {/* ⑦ Footer */}
      <LandingFooter />
    </div>
  );
}
