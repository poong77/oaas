'use client';

/**
 * LandingGuideView — 제품별 가이드 문서 시안 (Figma node 30:76 + 상세 아티클).
 *
 * 레이아웃:
 *   ① Header(authed) ② 제품 탭 + 검색
 *   ③ 본문 3컬럼 — 좌: 가이드 내비 트리(중분류 접기/펼치기) / 중앙: 아티클 본문 / 우: 목차(TOC) + 1:1 문의 CTA
 *   ④ Footer
 *
 * 본문 기능(첨부 기준): 배지 · 메타(발행/작성자/조회) · 인쇄/공유/링크 · 30초 요약 ·
 *   목표/사전준비/단계/다음단계(인라인 링크) · 만족도조사 · 관련 문서 카드.
 *
 * 색상 토큰: brand #00A36B · text #1A1C20 / #555D6D · bg #F7F8F9 · border #E5E7EB
 */

import { useState } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  ChevronDown,
  Printer,
  Share2,
  Link2,
  Calendar,
  User,
  Eye,
  ThumbsUp,
  ThumbsDown,
  Headset,
} from 'lucide-react';
import { LandingHeader } from './landing-header';
import { LandingFooter } from './landing-footer';

/** 마스터 대분류 미연결 시 폴백 탭. */
const FALLBACK_PRODUCT_TABS = ['PMS', 'CMS', 'Keyless', '키오스크', '웹서비스', '기타'];

type NavGroup = { group: string | null; items: string[] };

const NAV: NavGroup[] = [
  {
    group: '객실관리',
    items: [
      '실시간 객실(오늘)',
      '실시간 객실(오늘) 화면 구성',
      '객실 상태 변경하기',
      '청소요청(폰키) 상태값이 화면에 안 보일 때',
      '객실현황(이달)',
    ],
  },
  {
    group: '보고서',
    items: [
      '객실타입별 판매 비율로 객실 구성 최적화',
      '객실별 매출집계 화면과 검색 필터',
      '매출 상세 리스트 화면 구성',
      '대외출불 관리 화면 구성',
    ],
  },
  {
    group: '고객관리',
    items: ['고객정보 등록', '고객정보 조회', '객실 일마감'],
  },
];

const TOC = [
  '30초 요약',
  '목표',
  '사전 준비',
  '단계',
  '다음 단계',
  '관련 문서',
];

const STEPS = [
  '입장·조회구분·객실번호 선택 (필요시).',
  '조회 클릭 — 결과 표시.',
  '타입별 비율 분석 — 일/월/년 단위 평균단가 확인.',
  '출력/엑셀 — PDF 또는 엑셀.',
];

const NEXT_STEPS: { label: string; link: string; tone: 'brand' | 'rose' }[] = [
  { label: '다른 차원 분석 →', link: '유형별 매출집계', tone: 'brand' },
  { label: '거래처 차원 →', link: '거래처별 매출집계', tone: 'brand' },
  { label: '객실 판매 종합 →', link: 'Sales Report', tone: 'rose' },
];

const RELATED = [
  {
    title: '객실별 매출집계 화면과 검색 필터',
    summary:
      '입장·조회구분·객실타입 3개 필터로 객실별 판매 현황을 조회하고 역…',
  },
  {
    title: '매출 상세 리스트 화면 구성',
    summary: '매출별 상세 내역을 작업표시자 VOID 포함 여부 등 필터로 조회하여 객실 다…',
  },
  {
    title: '대외출불 관리 화면 구성',
    summary: '거래처별 미수금을 입장구분 거래처구분 필터로 조회하고 회수 처리 적용 다…',
  },
  {
    title: '객실별 잔여 현황 화면과 잔액 계산식',
    summary:
      '재실 고객 미납금을 다양한 필터로 조회. 당일잔액 = 전월이월 + 당일발생 - …',
  },
];

function slug(s: string) {
  return s.replace(/[^\w가-힣]/g, '-');
}

export function LandingGuideView({ products }: { products?: string[] }) {
  const tabs = products && products.length > 0 ? products : FALLBACK_PRODUCT_TABS;
  const [tab, setTab] = useState(tabs[0]);
  const [activeNav, setActiveNav] = useState(
    '객실타입별 판매 비율로 객실 구성 최적화',
  );
  // 중분류(그룹) 접기/펼치기 — 기본 전체 펼침
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggleGroup = (g: string) =>
    setCollapsed((p) => ({ ...p, [g]: !p[g] }));

  return (
    <div className="min-h-screen bg-white font-sans text-[#1A1C20]">
      <LandingHeader variant="authed" />

      {/* 제품 탭 (마스터 제품 대분류명) */}
      <div className="border-b border-[#E5E7EB] bg-white">
        <div className="mx-auto max-w-[1200px] px-5">
          <div className="flex items-center gap-1 overflow-x-auto">
            {tabs.map((p) => {
              const active = p === tab;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setTab(p)}
                  className={`shrink-0 border-b-2 px-4 py-3.5 text-sm font-semibold transition-colors ${
                    active
                      ? 'border-[#00A36B] text-[#00A36B]'
                      : 'border-transparent text-[#555D6D] hover:text-[#1A1C20]'
                  }`}
                >
                  {p}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 본문 3컬럼 */}
      <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-8 px-5 py-8 lg:grid-cols-[230px_minmax(0,1fr)_210px]">
        {/* ─ 좌측 내비 트리 (중분류 접기/펼치기) ─ */}
        <aside className="hidden lg:block">
          <nav className="sticky top-[84px] flex max-h-[calc(100vh-100px)] flex-col gap-2 overflow-y-auto pr-2 text-sm">
            {NAV.map((g, gi) => {
              if (!g.group) {
                return (
                  <div key={gi} className="flex flex-col gap-0.5">
                    {g.items.map((item) => (
                      <NavItem
                        key={item}
                        item={item}
                        active={item === activeNav}
                        onClick={() => setActiveNav(item)}
                      />
                    ))}
                  </div>
                );
              }
              const isOpen = !collapsed[g.group];
              return (
                <div key={gi} className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={() => toggleGroup(g.group!)}
                    className="flex items-center gap-1 rounded-md px-2 py-1.5 text-left text-xs font-bold text-[#1A1C20] hover:bg-[#F7F8F9]"
                    aria-expanded={isOpen}
                  >
                    {isOpen ? (
                      <ChevronDown className="h-3.5 w-3.5 text-[#868B94]" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 text-[#868B94]" />
                    )}
                    {g.group}
                  </button>
                  {isOpen && (
                    <div className="flex flex-col gap-0.5 pl-2">
                      {g.items.map((item) => (
                        <NavItem
                          key={item}
                          item={item}
                          active={item === activeNav}
                          onClick={() => setActiveNav(item)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </aside>

        {/* ─ 중앙 본문 ─ */}
        <article className="min-w-0">
          {/* 배지 */}
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            <Badge tone="brand">PMS</Badge>
            <Badge tone="brandSoft">사용방법</Badge>
            <Badge tone="slate">보고서</Badge>
            <Badge tone="brandSoft">객실별 매출집계</Badge>
          </div>

          <h1 className="text-2xl font-bold tracking-tight sm:text-[28px]">
            객실타입별 판매 비율로 객실 구성 최적화
          </h1>

          {/* 메타 */}
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#868B94]">
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              2026-05-31 발행
            </span>
            <span className="inline-flex items-center gap-1">
              <User className="h-3.5 w-3.5" />
              OA 매니저
            </span>
            <span className="inline-flex items-center gap-1">
              <Eye className="h-3.5 w-3.5" />
              조회 0
            </span>
          </div>

          {/* 액션 버튼 */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <ActionButton icon={<Printer className="h-4 w-4" />} label="인쇄" />
            <ActionButton icon={<Share2 className="h-4 w-4" />} label="공유" />
            <ActionButton icon={<Link2 className="h-4 w-4" />} label="링크" />
          </div>

          <div className="mt-6 flex flex-col gap-6">
            {/* 30초 요약 */}
            <section
              id={slug('30초 요약')}
              className="scroll-mt-24 rounded-xl border border-[#BCE7D5] bg-[#EDF9F3] p-5"
            >
              <p className="mb-1 text-sm font-bold text-[#00A36B]">30초 요약</p>
              <p className="text-sm leading-relaxed text-[#3F4651]">
                객실타입별 판매 비율을 분석해 잘 팔리는 타입의 객실 수 확대·요금
                조정 의사결정에 활용합니다.
              </p>
            </section>

            {/* 본문 카드 */}
            <div className="flex flex-col gap-8 rounded-xl border border-[#E5E7EB] p-6 sm:p-8">
              {/* 목표 */}
              <section id={slug('목표')} className="scroll-mt-24">
                <h2 className="mb-2 text-lg font-bold text-[#00A36B]">목표</h2>
                <p className="text-sm leading-relaxed text-[#3F4651]">
                  객실타입별 판매 비율을 분석해 객실 구성 최적화·요금 정책
                  의사결정에 활용합니다.
                </p>
              </section>

              {/* 사전 준비 */}
              <section id={slug('사전 준비')} className="scroll-mt-24">
                <h2 className="mb-2 text-lg font-bold text-[#00A36B]">사전 준비</h2>
                <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-[#3F4651]">
                  <li>
                    메뉴 경로:{' '}
                    <span className="font-medium text-[#1A1C20]">
                      PMS &gt; 보고서 &gt; 객실별 매출집계
                    </span>
                  </li>
                </ul>
              </section>

              {/* 단계 */}
              <section id={slug('단계')} className="scroll-mt-24">
                <h2 className="mb-2 text-lg font-bold text-[#00A36B]">단계</h2>
                <ol className="list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-[#3F4651]">
                  {STEPS.map((s, i) => {
                    const [head, ...rest] = s.split(' ');
                    return (
                      <li key={i}>
                        <span className="font-semibold text-[#1A1C20]">
                          {head}
                        </span>{' '}
                        {rest.join(' ')}
                      </li>
                    );
                  })}
                </ol>
              </section>

              {/* 다음 단계 */}
              <section id={slug('다음 단계')} className="scroll-mt-24">
                <h2 className="mb-2 text-lg font-bold text-[#00A36B]">다음 단계</h2>
                <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-[#3F4651]">
                  {NEXT_STEPS.map((n) => (
                    <li key={n.link}>
                      {n.label}{' '}
                      <Link
                        href="#"
                        className={`font-medium hover:underline ${
                          n.tone === 'rose'
                            ? 'text-[#E1306C]'
                            : 'text-[#00A36B]'
                        }`}
                      >
                        {n.link}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            {/* 만족도 조사 */}
            <section className="flex flex-col items-start justify-between gap-3 rounded-xl border border-[#E5E7EB] bg-[#F7F8F9] p-5 sm:flex-row sm:items-center">
              <p className="text-sm font-medium text-[#1A1C20]">
                이 문서가 도움이 되었나요?
              </p>
              <div className="flex items-center gap-2">
                <FeedbackButton
                  icon={<ThumbsUp className="h-4 w-4" />}
                  label="도움됐어요"
                />
                <FeedbackButton
                  icon={<ThumbsDown className="h-4 w-4" />}
                  label="아니에요"
                />
              </div>
            </section>

            {/* 관련 문서 */}
            <section id={slug('관련 문서')} className="scroll-mt-24">
              <h2 className="mb-3 text-base font-bold text-[#1A1C20]">관련 문서</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {RELATED.map((r) => (
                  <Link
                    key={r.title}
                    href="#"
                    className="flex flex-col gap-2 rounded-xl border border-[#E5E7EB] bg-white p-4 transition-shadow hover:shadow-md"
                  >
                    <div className="flex items-center gap-1.5">
                      <Badge tone="brand">PMS</Badge>
                      <Badge tone="blue">기능설명</Badge>
                    </div>
                    <p className="text-sm font-semibold text-[#1A1C20]">
                      {r.title}
                    </p>
                    <p className="line-clamp-2 text-xs leading-relaxed text-[#868B94]">
                      {r.summary}
                    </p>
                  </Link>
                ))}
              </div>
            </section>

            <p className="border-t border-[#E5E7EB] pt-4 text-xs text-[#868B94]">
              Last updated on 2026.06.08
            </p>
          </div>
        </article>

        {/* ─ 우측 목차(TOC) + 1:1 문의 CTA ─ */}
        <aside className="hidden lg:block">
          <div className="sticky top-[84px] flex flex-col gap-5">
            <div className="flex flex-col gap-2 text-sm">
              <p className="text-xs font-bold text-[#1A1C20]">목차</p>
              <nav className="flex flex-col gap-1 border-l border-[#E5E7EB]">
                {TOC.map((t, i) => (
                  <Link
                    key={t}
                    href={`#${slug(t)}`}
                    className={`-ml-px border-l-2 py-1 pl-3 leading-snug transition-colors ${
                      i === 0
                        ? 'border-[#00A36B] font-semibold text-[#00A36B]'
                        : 'border-transparent text-[#868B94] hover:border-[#D1D5DC] hover:text-[#1A1C20]'
                    }`}
                  >
                    {t}
                  </Link>
                ))}
              </nav>
            </div>

            {/* 문의하기 CTA */}
            <div className="flex flex-col gap-3 rounded-xl border border-[#BCE7D5] bg-[#EDF9F3] p-4">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#00A36B]/10">
                  <Headset className="h-4 w-4 text-[#00A36B]" />
                </span>
                <p className="text-sm font-bold text-[#1A1C20]">
                  해결되지 않았나요?
                </p>
              </div>
              <p className="text-xs leading-relaxed text-[#555D6D]">
                가이드로 해결되지 않으면 1:1로 문의해 주세요. 성실히
                답변드립니다.
              </p>
              <Link
                href="/landing/inquiry"
                className="rounded-lg bg-[#00A36B] px-4 py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-[#008A59]"
              >
                문의하기
              </Link>
            </div>
          </div>
        </aside>
      </div>

      <LandingFooter />
    </div>
  );
}

function NavItem({
  item,
  active,
  onClick,
}: {
  item: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-2 py-1.5 text-left leading-snug transition-colors ${
        active
          ? 'bg-[#E6F7F0] font-semibold text-[#00A36B]'
          : 'text-[#555D6D] hover:bg-[#F7F8F9] hover:text-[#1A1C20]'
      }`}
    >
      {item}
    </button>
  );
}

function Badge({
  tone,
  children,
}: {
  tone: 'brand' | 'brandSoft' | 'blue' | 'slate';
  children: React.ReactNode;
}) {
  const cls =
    tone === 'brand'
      ? 'bg-[#00A36B] text-white'
      : tone === 'brandSoft'
        ? 'bg-[#E6F7F0] text-[#00A36B]'
        : tone === 'blue'
          ? 'bg-[#DBEAFE] text-[#1D4ED8]'
          : 'bg-[#F1F3F5] text-[#555D6D]';
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      {children}
    </span>
  );
}

function ActionButton({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1.5 rounded-lg border border-[#DCDEE3] px-3 py-1.5 text-sm font-medium text-[#555D6D] transition-colors hover:bg-[#F7F8F9] hover:text-[#1A1C20]"
    >
      {icon}
      {label}
    </button>
  );
}

function FeedbackButton({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1.5 rounded-lg border border-[#DCDEE3] bg-white px-3 py-1.5 text-sm font-medium text-[#555D6D] transition-colors hover:border-[#00A36B] hover:text-[#00A36B]"
    >
      {icon}
      {label}
      <span className="ml-0.5 text-xs text-[#868B94]">0</span>
    </button>
  );
}
