'use client';

/**
 * ContactPanel — 운영시간 + ARS + 연락처 통합 패널.
 *
 * variant:
 *   - sidebar: 도움말/티켓 페이지 우측 sticky 카드 (수직 레이아웃)
 *   - footer:  사이트 푸터 (가로 레이아웃)
 *
 * 데이터 출처: useBusinessStatus() (운영시간 마스터 ↔ 호텔리어 단일 진실)
 * 영업 외 시간엔 긴급전화·익일 자동 처리 안내 강조.
 *
 * ARS 메뉴(1/2/3번)는 정책 자체에 들어가는 마스터 데이터가 아니므로
 * 현재는 컴포넌트 내 상수. 다국화·정책 변경 잦으면 system_settings 마스터로 이동.
 */

import { Calendar, Coffee, Mail, MessageCircle, Phone } from 'lucide-react';
import { useBusinessStatus } from '@/lib/hooks/use-business-status';
import type { BusinessStatusResult } from '@/lib/business-hours/calculate';
import { BusinessStatusBadge } from './business-status-badge';

type Variant = 'sidebar' | 'footer';

type Props = {
  variant: Variant;
  /** 챗봇 트리거 함수 — 제공되면 "챗봇으로 물어보기" CTA 표시 */
  onChatbotOpen?: () => void;
  /** 이슈 접수 페이지 경로 */
  intakeHref?: string;
};

const ARS_ITEMS = [
  { num: '1', label: '시스템 사용 문의' },
  { num: '2', label: '도입 상담' },
  { num: '3', label: '경영·회계 기타' },
];

const MAIN_PHONE = '1833-4702';
const MAIN_EMAIL = 'as@oapms.com';

export function ContactPanel({
  variant,
  onChatbotOpen,
  intakeHref = '/tickets/new',
}: Props) {
  const { status, unavailable } = useBusinessStatus();

  if (unavailable) {
    return variant === 'sidebar' ? <PanelUnavailable variant={variant} /> : null;
  }

  if (variant === 'sidebar') {
    return (
      <SidebarPanel
        status={status}
        onChatbotOpen={onChatbotOpen}
        intakeHref={intakeHref}
      />
    );
  }

  return (
    <FooterPanel
      status={status}
      onChatbotOpen={onChatbotOpen}
      intakeHref={intakeHref}
    />
  );
}

// ─────────────────────────────────────────────────────────────────
// Sidebar variant
// ─────────────────────────────────────────────────────────────────

function SidebarPanel({
  status,
  onChatbotOpen,
  intakeHref,
}: {
  status: BusinessStatusResult | null;
  onChatbotOpen?: () => void;
  intakeHref: string;
}) {
  const isClosed = status?.status === 'closed';
  const phone = status?.emergencyPhone ?? null;

  return (
    <aside
      id="hours"
      className="sticky top-20 flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <BusinessStatusBadge size="md" linkTo="#hours" />

      {/* 셀프 해결 CTA */}
      <div className="flex flex-col gap-1.5">
        {onChatbotOpen && (
          <button
            type="button"
            onClick={onChatbotOpen}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-500"
          >
            <MessageCircle className="h-4 w-4" />
            챗봇으로 바로 물어보기
          </button>
        )}
        <a
          href={intakeHref}
          className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <Calendar className="h-4 w-4" />
          이슈 접수하기
        </a>
      </div>

      {/* 대표전화 + ARS */}
      <section className="flex flex-col gap-2 rounded-md bg-slate-50 p-3 dark:bg-slate-800/40">
        <a
          href={`tel:${MAIN_PHONE.replace(/-/g, '')}`}
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-50"
        >
          <Phone className="h-4 w-4" />
          {MAIN_PHONE}
        </a>
        <ul className="flex flex-col gap-0.5 pl-6 text-xs text-slate-600 dark:text-slate-300">
          {ARS_ITEMS.map((a) => (
            <li key={a.num} className="flex gap-1.5">
              <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                {a.num}
              </span>
              {a.label}
            </li>
          ))}
        </ul>
        <a
          href={`mailto:${MAIN_EMAIL}`}
          className="mt-1 inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400"
        >
          <Mail className="h-3.5 w-3.5" />
          {MAIN_EMAIL}
        </a>
      </section>

      {/* 긴급전화 — 영업 외 시간 강조 */}
      {phone && (
        <section
          className={
            isClosed
              ? 'flex flex-col gap-1 rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-950/30'
              : 'flex flex-col gap-1 rounded-md border border-slate-200 p-3 dark:border-slate-700'
          }
        >
          <span
            className={
              'text-[10px] font-semibold uppercase tracking-wide ' +
              (isClosed
                ? 'text-amber-700 dark:text-amber-300'
                : 'text-slate-500 dark:text-slate-400')
            }
          >
            영업시간 외 긴급
          </span>
          <a
            href={`tel:${phone.replace(/-/g, '')}`}
            className={
              'inline-flex items-center gap-1.5 text-sm font-semibold ' +
              (isClosed
                ? 'text-amber-900 dark:text-amber-200'
                : 'text-slate-800 dark:text-slate-200')
            }
          >
            <Phone className="h-4 w-4" />
            {phone}
          </a>
          {status?.emergencyNote && (
            <p
              className={
                'text-xs ' +
                (isClosed
                  ? 'text-amber-800 dark:text-amber-300'
                  : 'text-slate-500 dark:text-slate-400')
              }
            >
              {status.emergencyNote}
            </p>
          )}
        </section>
      )}
    </aside>
  );
}

// ─────────────────────────────────────────────────────────────────
// Footer variant
// ─────────────────────────────────────────────────────────────────

function FooterPanel({
  status,
  onChatbotOpen,
  intakeHref,
}: {
  status: BusinessStatusResult | null;
  onChatbotOpen?: () => void;
  intakeHref: string;
}) {
  const phone = status?.emergencyPhone ?? null;

  return (
    <footer className="border-t border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950">
      <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6 sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
        {/* 영업상태 */}
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            영업 상태
          </h3>
          <BusinessStatusBadge size="md" linkTo="/support#hours" />
        </div>

        {/* 대표전화 + ARS */}
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            대표전화
          </h3>
          <a
            href={`tel:${MAIN_PHONE.replace(/-/g, '')}`}
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-50"
          >
            <Phone className="h-4 w-4" />
            {MAIN_PHONE}
          </a>
          <ul className="text-xs text-slate-600 dark:text-slate-300">
            {ARS_ITEMS.map((a) => (
              <li key={a.num}>
                {a.num}번 — {a.label}
              </li>
            ))}
          </ul>
        </div>

        {/* 이메일 + 긴급 */}
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            이메일·긴급
          </h3>
          <a
            href={`mailto:${MAIN_EMAIL}`}
            className="inline-flex items-center gap-2 text-sm text-slate-700 hover:underline dark:text-slate-200"
          >
            <Mail className="h-4 w-4" />
            {MAIN_EMAIL}
          </a>
          {phone && (
            <a
              href={`tel:${phone.replace(/-/g, '')}`}
              className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200"
            >
              <Phone className="h-4 w-4 text-amber-600" />
              <span className="font-semibold">{phone}</span>
              <span className="text-xs text-slate-500">영업 외 긴급</span>
            </a>
          )}
        </div>

        {/* 셀프 해결 */}
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            빠른 해결
          </h3>
          {onChatbotOpen && (
            <button
              type="button"
              onClick={onChatbotOpen}
              className="inline-flex w-fit items-center gap-1.5 rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-500"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              챗봇 열기
            </button>
          )}
          <a
            href={intakeHref}
            className="inline-flex w-fit items-center gap-1.5 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
          >
            <Calendar className="h-3.5 w-3.5" />
            이슈 접수
          </a>
          {status?.emergencyNote && (
            <p className="mt-1 text-xs text-slate-500">{status.emergencyNote}</p>
          )}
        </div>
      </div>
      <div className="border-t border-slate-200 px-4 py-3 text-center text-[11px] text-slate-400 dark:border-slate-800 lg:px-8">
        평일 10:00–18:40 · 점심 12:00–13:00 (
        <Coffee className="inline h-3 w-3" />) · 토·일·공휴일 휴무 · Fax 0505-300-4702
      </div>
    </footer>
  );
}

// ─────────────────────────────────────────────────────────────────
// Unavailable fallback (정책 미설정)
// ─────────────────────────────────────────────────────────────────

function PanelUnavailable({ variant }: { variant: Variant }) {
  void variant;
  return (
    <aside className="sticky top-20 flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <a
        href={`tel:${MAIN_PHONE.replace(/-/g, '')}`}
        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-50"
      >
        <Phone className="h-4 w-4" />
        {MAIN_PHONE}
      </a>
      <a
        href={`mailto:${MAIN_EMAIL}`}
        className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400"
      >
        <Mail className="h-3.5 w-3.5" />
        {MAIN_EMAIL}
      </a>
    </aside>
  );
}
