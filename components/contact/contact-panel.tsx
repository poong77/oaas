'use client';

/**
 * ContactPanel — 운영시간 + 연락처 통합 패널.
 *
 * variant:
 *   - sidebar: 도움말/티켓 페이지 우측 sticky 카드 (수직 레이아웃)
 *   - footer:  사이트 푸터 (가로 레이아웃)
 *
 * 데이터 출처: useBusinessStatus() → status + hours
 *   - status.contact: 대표전화·이메일·ARS·Fax·웹사이트 (어드민이 마스터에서 편집)
 *   - hours: 운영시간 원본 (footer 안내문 동적 생성)
 *
 * 모든 표시 정보는 `business_hours_default` 한 테이블에서 일원화됨.
 * (P3 정리, 2026-05-30 — 이전엔 일부 하드코딩되어 있었음)
 */

import { useEffect, useRef } from 'react';
import {
  Calendar,
  Mail,
  MessageCircle,
  Phone,
  Clock,
  Monitor,
  AlertTriangle,
} from 'lucide-react';
import { useBusinessStatus } from '@/lib/hooks/use-business-status';
import type {
  BusinessHoursInput,
  BusinessStatusResult,
} from '@/lib/business-hours/calculate';
import { toHHMM } from '@/lib/business-hours/format';
import { BusinessStatusBadge } from './business-status-badge';

type Variant = 'sidebar' | 'footer';

type Props = {
  variant: Variant;
  /** 챗봇 트리거 함수 — 제공되면 "챗봇으로 물어보기" CTA 표시 */
  onChatbotOpen?: () => void;
  /** 이슈 접수 페이지 경로 */
  intakeHref?: string;
};

export function ContactPanel({
  variant,
  onChatbotOpen,
  intakeHref = '/tickets/new',
}: Props) {
  const { status, hours, unavailable } = useBusinessStatus();

  if (unavailable || !hours) {
    return variant === 'sidebar' ? <PanelUnavailable /> : null;
  }

  if (variant === 'sidebar') {
    return (
      <SidebarPanel
        status={status}
        hours={hours}
        onChatbotOpen={onChatbotOpen}
        intakeHref={intakeHref}
      />
    );
  }

  return <FooterPanel status={status} hours={hours} />;
}

// ─────────────────────────────────────────────────────────────────
// Sidebar variant
// ─────────────────────────────────────────────────────────────────

function SidebarPanel({
  status,
  hours,
  onChatbotOpen,
  intakeHref,
}: {
  status: BusinessStatusResult | null;
  hours: BusinessHoursInput;
  onChatbotOpen?: () => void;
  intakeHref: string;
}) {
  const isClosed = status?.status === 'closed';
  const contact = status?.contact ?? extractContactFallback(hours);
  const emergencyPhone = status?.emergencyPhone ?? hours.emergencyPhone;
  const emergencyNote = status?.emergencyNote ?? hours.emergencyNote;

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
      {(contact.mainPhone || contact.mainEmail || contact.arsItems.length > 0) && (
        <section className="flex flex-col gap-2 rounded-md bg-slate-50 p-3 dark:bg-slate-800/40">
          {contact.mainPhone && (
            <a
              href={`tel:${contact.mainPhone.replace(/-/g, '')}`}
              className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-50"
            >
              <Phone className="h-4 w-4" />
              {contact.mainPhone}
            </a>
          )}
          {contact.arsItems.length > 0 && (
            <ul className="flex flex-col gap-0.5 pl-6 text-xs text-slate-600 dark:text-slate-300">
              {contact.arsItems.map((a) => (
                <li key={a.num} className="flex gap-1.5">
                  <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                    {a.num}
                  </span>
                  {a.label}
                </li>
              ))}
            </ul>
          )}
          {contact.mainEmail && (
            <a
              href={`mailto:${contact.mainEmail}`}
              className="mt-1 inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400"
            >
              <Mail className="h-3.5 w-3.5" />
              {contact.mainEmail}
            </a>
          )}
        </section>
      )}

      {/* 긴급전화 — 운영 외 시간 강조 */}
      {emergencyPhone && (
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
            운영시간 외 긴급
          </span>
          <a
            href={`tel:${emergencyPhone.replace(/-/g, '')}`}
            className={
              'inline-flex items-center gap-1.5 text-sm font-semibold ' +
              (isClosed
                ? 'text-amber-900 dark:text-amber-200'
                : 'text-slate-800 dark:text-slate-200')
            }
          >
            <Phone className="h-4 w-4" />
            {emergencyPhone}
          </a>
          {emergencyNote && (
            <p
              className={
                'text-xs ' +
                (isClosed
                  ? 'text-amber-800 dark:text-amber-300'
                  : 'text-slate-500 dark:text-slate-400')
              }
            >
              {emergencyNote}
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
  hours,
}: {
  status: BusinessStatusResult | null;
  hours: BusinessHoursInput;
}) {
  const contact = status?.contact ?? extractContactFallback(hours);
  const emergencyPhone = status?.emergencyPhone ?? hours.emergencyPhone;
  const emergencyNote = status?.emergencyNote ?? hours.emergencyNote;
  const highlightRef = useRef<HTMLDivElement>(null);

  /*
   * 운영상태 칼럼 강조 효과 트리거.
   *   - hash가 #contact가 될 때 / 동일 hash로의 재클릭 시 모두 발동.
   *   - smooth scroll이 도착할 즈음(~550ms)에 효과 시작 → 사용자가 도착 직후 시선 잡힘.
   *   - .contact-highlight-active 클래스를 add/remove + reflow trick으로 매번 애니메이션 재실행.
   */
  useEffect(() => {
    function fire() {
      const el = highlightRef.current;
      if (!el) return;
      el.classList.remove('contact-highlight-active');
      // 강제 reflow — 같은 클래스 재추가 시에도 animation을 다시 실행하도록.
      void el.offsetWidth;
      el.classList.add('contact-highlight-active');
    }

    function scheduleIfContactHash(delay = 550) {
      if (typeof window === 'undefined') return;
      if (window.location.hash !== '#contact') return;
      window.setTimeout(fire, delay);
    }

    // 초기 진입 시 hash가 이미 #contact인 경우 (외부 링크 등)
    scheduleIfContactHash(700);

    function onHashChange() {
      scheduleIfContactHash();
    }
    window.addEventListener('hashchange', onHashChange);

    // 동일 hash 재클릭 (hashchange 이벤트 미발생) 보완 — 문서 전역 클릭 인터셉트
    function onDocClick(e: MouseEvent) {
      const target = e.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest('a[href="#contact"]');
      if (anchor) scheduleIfContactHash();
    }
    document.addEventListener('click', onDocClick);

    return () => {
      window.removeEventListener('hashchange', onHashChange);
      document.removeEventListener('click', onDocClick);
    };
  }, []);

  return (
    <section
      id="contact"
      ref={highlightRef}
      className="scroll-mt-20 bg-slate-50 px-4 py-12 dark:bg-slate-900/40 sm:px-6 lg:px-8"
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <h2 className="text-xl font-bold tracking-tight sm:text-2xl">고객센터</h2>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* 고객센터 전화 + ARS */}
          <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2">
              <Phone className="h-5 w-5 text-brand-600 dark:text-brand-400" />
              <span className="text-base font-semibold">고객센터</span>
            </div>
            {contact.mainPhone && (
              <a
                href={`tel:${contact.mainPhone.replace(/-/g, '')}`}
                className="text-2xl font-bold text-brand-600 dark:text-brand-400"
              >
                {contact.mainPhone}
              </a>
            )}
            {contact.arsItems.length > 0 && (
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-700 dark:text-slate-200">
                {contact.arsItems.map((a, i) => (
                  <span key={a.num} className="inline-flex items-center gap-2">
                    {i > 0 && <span className="text-slate-300">·</span>}
                    <span>
                      <b className="font-semibold">{a.num}번</b> {a.label}
                    </span>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* 상담시간 */}
          <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-brand-600 dark:text-brand-400" />
              <span className="text-base font-semibold">상담시간</span>
            </div>
            <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm text-slate-600 dark:text-slate-300">
              <span className="text-slate-800 dark:text-slate-100">평일</span>
              <span>
                {toHHMM(hours.weekdayOpen)}~{toHHMM(hours.weekdayClose)}
              </span>
              {hours.lunchStart && hours.lunchEnd && (
                <>
                  <span className="text-slate-800 dark:text-slate-100">점심시간</span>
                  <span>
                    {toHHMM(hours.lunchStart)}~{toHHMM(hours.lunchEnd)}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* 이메일 및 팩스 */}
          <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-brand-600 dark:text-brand-400" />
              <span className="text-base font-semibold">이메일 및 팩스</span>
            </div>
            <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm text-slate-600 dark:text-slate-300">
              {contact.mainEmail && (
                <>
                  <span className="text-slate-800 dark:text-slate-100">이메일</span>
                  <a href={`mailto:${contact.mainEmail}`} className="truncate hover:underline">
                    {contact.mainEmail}
                  </a>
                </>
              )}
              {contact.faxNumber && (
                <>
                  <span className="text-slate-800 dark:text-slate-100">팩스</span>
                  <span>{contact.faxNumber}</span>
                </>
              )}
            </div>
          </div>

          {/* 야간/휴일 긴급 장애 신고 */}
          <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <span className="text-base font-semibold">
                야간/휴일 <span className="text-red-500">긴급 장애 신고</span>
              </span>
            </div>
            {emergencyPhone && (
              <a
                href={`tel:${emergencyPhone.replace(/-/g, '')}`}
                className="text-xl font-bold text-slate-900 dark:text-white"
              >
                {emergencyPhone}
              </a>
            )}
            {emergencyNote && (
              <p className="text-xs text-slate-500 dark:text-slate-400">{emergencyNote}</p>
            )}
          </div>
        </div>

        {/* PC 원격 연결 서비스 — 원격지원 아웃링크(고정) */}
        <div className="flex flex-col items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Monitor className="h-5 w-5 text-brand-600 dark:text-brand-400" />
              <span className="text-base font-semibold">PC 원격 연결 서비스</span>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              원활한 문제 해결이 필요하신가요? 파트너의 안내에 따라 원격지원 연결하기 버튼을 눌러주세요.
            </p>
          </div>
          <a
            href="https://939.co.kr/oatech/"
            target="_blank"
            rel="noreferrer"
            className="shrink-0 rounded-lg bg-brand-50 px-5 py-2.5 text-sm font-medium text-brand-700 hover:bg-brand-100 dark:bg-brand-950/40 dark:text-brand-300 dark:hover:bg-brand-900/50"
          >
            원격지원 연결하기
          </a>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────
// Unavailable fallback (정책 미설정)
// ─────────────────────────────────────────────────────────────────

function PanelUnavailable() {
  return (
    <aside className="sticky top-20 flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs text-slate-500">
        운영시간이 아직 설정되지 않았습니다. 어드민이 설정하면 자동으로 표시됩니다.
      </p>
    </aside>
  );
}

// ─────────────────────────────────────────────────────────────────
// helpers
// ─────────────────────────────────────────────────────────────────

/** status가 null인 짧은 시점에 hours로 직접 contact 구성 (skeleton 케이스). */
function extractContactFallback(
  hours: BusinessHoursInput,
): NonNullable<BusinessStatusResult['contact']> {
  return {
    mainPhone: hours.mainPhone,
    mainEmail: hours.mainEmail,
    arsItems: hours.arsItems,
    faxNumber: hours.faxNumber,
    websiteUrl: hours.websiteUrl,
  };
}

