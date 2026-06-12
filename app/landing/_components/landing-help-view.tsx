'use client';

/**
 * LandingHelpView — 제품별 가이드 목록 시안.
 *
 * 레이아웃:
 *   ① Header(authed)
 *   ② 브레드크럼 + 제품 헤더(아이콘 · "{제품} 가이드" · 서브타이틀)
 *   ③ 툴바(제품 내 검색 + 정렬)
 *   ④ 2컬럼 — 좌: 카테고리 트리(전체/중·소분류 + 다른 제품) / 우: 아티클 카드 그리드
 *   ⑤ 하단 help.oapms.com 안내 ⑥ Footer
 *
 * 색상 토큰: brand #00A36B · text #1A1C20 / #555D6D · bg #F7F8F9 · border #E5E7EB
 */

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Search,
  ChevronDown,
  ChevronRight,
  Eye,
  Building2,
  ExternalLink,
} from 'lucide-react';
import { LandingHeader } from './landing-header';
import { LandingFooter } from './landing-footer';

const FALLBACK_PRODUCTS = ['PMS', '홈페이지', 'CMS', 'Keyless', 'Kiosk', '기타'];

type TreeNode = {
  label: string;
  count: number;
  active?: boolean;
  children?: { label: string; count: number; active?: boolean }[];
};

const CATEGORY_TREE: TreeNode[] = [
  { label: '객실관리', count: 35 },
  { label: '고객관리', count: 4 },
  {
    label: '객실 일마감',
    count: 6,
    children: [
      { label: '일마감 사전체크', count: 3 },
      { label: '일마감', count: 3, active: true },
    ],
  },
  { label: '보고서', count: 26 },
];
const TOTAL_COUNT = 71;

type Card = {
  type: string;
  tone: 'amber' | 'green' | 'blue';
  cats: string[];
  title: string;
  summary: string;
  views: number;
};

const CARDS: Card[] = [
  {
    type: '문제해결',
    tone: 'amber',
    cats: ['객실 일마감', '일마감'],
    title: '일마감이 진행되지 않을 때',
    summary:
      '노쇼·체크아웃·매출입금 3대 원인 점검과 잔액 조정으로 대부분 해결됩니다.',
    views: 3,
  },
  {
    type: '사용방법',
    tone: 'green',
    cats: ['객실 일마감', '일마감'],
    title: '일마감 안전하게 처리하기',
    summary:
      '마감 전 3가지 필수 확인 → 사전점검 → 영업일자 변경 → 마감 버튼의 표준 절차입니다.',
    views: 0,
  },
  {
    type: '기능설명',
    tone: 'blue',
    cats: ['객실 일마감', '일마감'],
    title: '일마감 화면 구성과 영업일자 변경',
    summary:
      '숙소의 하루를 마무리하고 영업일자를 익일로 변경. 마감 시 객실료 자동 부과·보고서 자동 생성.',
    views: 0,
  },
];

const TONE: Record<Card['tone'], string> = {
  amber: 'bg-[#FEF3C7] text-[#B45309]',
  green: 'bg-[#E6F7F0] text-[#00A36B]',
  blue: 'bg-[#DBEAFE] text-[#1D4ED8]',
};

export function LandingHelpView({ products }: { products?: string[] }) {
  const list = products && products.length > 0 ? products : FALLBACK_PRODUCTS;
  const current = list[0];
  const others = list.slice(1);

  const [activeCat, setActiveCat] = useState('일마감');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggle = (g: string) => setCollapsed((p) => ({ ...p, [g]: !p[g] }));

  return (
    <div className="min-h-screen bg-white font-sans text-[#1A1C20]">
      <LandingHeader variant="authed" />

      <div className="mx-auto max-w-[1200px] px-5 py-6">
        {/* 브레드크럼 */}
        <Link
          href="/landing"
          className="mb-4 inline-flex items-center gap-1 text-sm text-[#868B94] hover:text-[#1A1C20]"
        >
          <ArrowLeft className="h-4 w-4" />
          제품별 가이드
        </Link>

        {/* 제품 헤더 */}
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#E6F7F0]">
            <Building2 className="h-6 w-6 text-[#00A36B]" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{current} 가이드</h1>
          </div>
        </div>
        <p className="mt-2 text-sm text-[#555D6D]">
          {current} 사용을 위한 핸드북·체크리스트·점검 절차 (총 {CARDS.length}건)
        </p>

        {/* 툴바 */}
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="flex flex-1 items-center gap-2 rounded-lg border border-[#DCDEE3] bg-white px-4 py-2.5 focus-within:border-[#00A36B]">
            <Search className="h-4 w-4 shrink-0 text-[#868B94]" />
            <input
              type="search"
              placeholder="이 제품 안에서 검색"
              className="w-full bg-transparent text-sm text-[#1A1C20] placeholder:text-[#B0B3BA] focus:outline-none"
            />
          </label>
          <select className="rounded-lg border border-[#DCDEE3] bg-white px-3 py-2.5 text-sm text-[#1A1C20] focus:border-[#00A36B] focus:outline-none sm:w-44">
            <option>최신 발행순</option>
            <option>조회순</option>
            <option>제목순</option>
          </select>
        </div>

        {/* 2컬럼 */}
        <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-[230px_minmax(0,1fr)]">
          {/* 좌측 카테고리 트리 */}
          <aside className="hidden lg:block">
            <div className="sticky top-[84px] flex flex-col gap-5 text-sm">
              <div className="rounded-xl border border-[#E5E7EB] p-3">
                <div className="mb-2 flex items-center justify-between px-1">
                  <span className="text-xs font-bold text-[#1A1C20]">카테고리</span>
                  <span className="text-xs text-[#868B94]">전체 ({TOTAL_COUNT})</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  {CATEGORY_TREE.map((node) => {
                    if (!node.children) {
                      return (
                        <CatRow
                          key={node.label}
                          label={node.label}
                          count={node.count}
                          active={node.label === activeCat}
                          onClick={() => setActiveCat(node.label)}
                        />
                      );
                    }
                    const open = !collapsed[node.label];
                    return (
                      <div key={node.label} className="flex flex-col gap-0.5">
                        <button
                          type="button"
                          onClick={() => toggle(node.label)}
                          className="flex items-center gap-1 rounded-md px-2 py-1.5 text-left text-[#1A1C20] hover:bg-[#F7F8F9]"
                          aria-expanded={open}
                        >
                          {open ? (
                            <ChevronDown className="h-3.5 w-3.5 text-[#868B94]" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 text-[#868B94]" />
                          )}
                          <span className="flex-1 font-medium">{node.label}</span>
                          <span className="text-xs text-[#868B94]">{node.count}</span>
                        </button>
                        {open && (
                          <div className="flex flex-col gap-0.5 pl-4">
                            {node.children.map((c) => (
                              <CatRow
                                key={c.label}
                                label={c.label}
                                count={c.count}
                                active={c.label === activeCat}
                                onClick={() => setActiveCat(c.label)}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 다른 제품 */}
              <div className="rounded-xl border border-[#E5E7EB] p-3">
                <p className="mb-2 px-1 text-xs font-bold text-[#1A1C20]">다른 제품</p>
                <div className="flex flex-col gap-0.5">
                  {others.map((p) => (
                    <Link
                      key={p}
                      href="/landing/help"
                      className="rounded-md px-2 py-1.5 text-[#555D6D] transition-colors hover:bg-[#F7F8F9] hover:text-[#1A1C20]"
                    >
                      {p}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          {/* 우측 카드 그리드 */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {CARDS.map((c) => (
              <Link
                key={c.title}
                href="/landing/guide"
                className="flex flex-col gap-2 rounded-xl border border-[#E5E7EB] bg-white p-5 transition-shadow hover:shadow-md"
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${TONE[c.tone]}`}
                  >
                    {c.type}
                  </span>
                  {c.cats.map((cat) => (
                    <span
                      key={cat}
                      className="inline-flex items-center rounded-md bg-[#F1F3F5] px-2 py-0.5 text-xs font-medium text-[#555D6D]"
                    >
                      {cat}
                    </span>
                  ))}
                </div>
                <p className="text-base font-semibold text-[#1A1C20]">{c.title}</p>
                <p className="line-clamp-2 text-sm leading-relaxed text-[#555D6D]">
                  {c.summary}
                </p>
                <span className="mt-1 inline-flex items-center gap-1 text-xs text-[#868B94]">
                  <Eye className="h-3.5 w-3.5" />
                  {c.views}
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* 하단 help.oapms.com 안내 */}
        <div className="mt-8 flex flex-col items-start justify-between gap-3 rounded-xl border border-[#E5E7EB] bg-[#F7F8F9] p-5 sm:flex-row sm:items-center">
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-semibold text-[#1A1C20]">
              찾는 내용이 없으신가요?
            </p>
            <p className="text-xs text-[#868B94]">
              기존 help.oapms.com에 같은 주제가 있을 수 있습니다.
            </p>
          </div>
          <a
            href="https://help.oapms.com"
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#DCDEE3] bg-white px-4 py-2.5 text-sm font-semibold text-[#1A1C20] transition-colors hover:bg-[#F1F3F5]"
          >
            help.oapms.com 열기
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>

      <LandingFooter />
    </div>
  );
}

function CatRow({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1 rounded-md px-2 py-1.5 text-left transition-colors ${
        active
          ? 'bg-[#E6F7F0] font-semibold text-[#00A36B]'
          : 'text-[#555D6D] hover:bg-[#F7F8F9] hover:text-[#1A1C20]'
      }`}
    >
      <span className="flex-1">{label}</span>
      <span className={`text-xs ${active ? 'text-[#00A36B]' : 'text-[#868B94]'}`}>
        {count}
      </span>
    </button>
  );
}
