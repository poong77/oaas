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

import { Calendar, Coffee, Mail, MessageCircle, Phone } from 'lucide-react';
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

  return (
    <FooterPanel
      status={status}
      hours={hours}
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
  onChatbotOpen,
  intakeHref,
}: {
  status: BusinessStatusResult | null;
  hours: BusinessHoursInput;
  onChatbotOpen?: () => void;
  intakeHref: string;
}) {
  const contact = status?.contact ?? extractContactFallback(hours);
  const emergencyPhone = status?.emergencyPhone ?? hours.emergencyPhone;

  return (
    <footer
      id="contact"
      className="scroll-mt-20 border-t border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950"
    >
      <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6 sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
        {/* 운영상태 — 헤더 배지 클릭 시 :target 강조 효과 적용 (globals.css) */}
        <div className="flex flex-col gap-2" data-contact-highlight>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            운영 상태
          </h3>
          <BusinessStatusBadge size="md" linkTo="#contact" />
        </div>

        {/* 대표전화 + ARS */}
        {(contact.mainPhone || contact.arsItems.length > 0) && (
          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              대표전화
            </h3>
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
              <ul className="text-xs text-slate-600 dark:text-slate-300">
                {contact.arsItems.map((a) => (
                  <li key={a.num}>
                    {a.num}번 — {a.label}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* 이메일 + 긴급 */}
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            이메일·긴급
          </h3>
          {contact.mainEmail && (
            <a
              href={`mailto:${contact.mainEmail}`}
              className="inline-flex items-center gap-2 text-sm text-slate-700 hover:underline dark:text-slate-200"
            >
              <Mail className="h-4 w-4" />
              {contact.mainEmail}
            </a>
          )}
          {emergencyPhone && (
            <a
              href={`tel:${emergencyPhone.replace(/-/g, '')}`}
              className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200"
            >
              <Phone className="h-4 w-4 text-amber-600" />
              <span className="font-semibold">{emergencyPhone}</span>
              <span className="text-xs text-slate-500">운영 외 긴급</span>
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
        </div>
      </div>
      <div className="border-t border-slate-200 px-4 py-3 text-center text-[11px] text-slate-400 dark:border-slate-800 lg:px-8">
        {summarizeOperationLine(hours)}
        {contact.faxNumber && ` · Fax ${contact.faxNumber}`}
        {contact.websiteUrl && ` · ${contact.websiteUrl}`}
      </div>
    </footer>
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

/** "평일 10:00–18:40 · 점심 12:00–13:00 · 토·일·공휴일 휴무" 형식 동적 생성. */
function summarizeOperationLine(hours: BusinessHoursInput): string {
  const parts: string[] = [];
  parts.push(`평일 ${toHHMM(hours.weekdayOpen)}–${toHHMM(hours.weekdayClose)}`);
  if (hours.lunchStart && hours.lunchEnd) {
    parts.push(`점심 ${toHHMM(hours.lunchStart)}–${toHHMM(hours.lunchEnd)}`);
  }
  const closedDays: string[] = [];
  if (hours.saturdayClosed) closedDays.push('토');
  if (hours.sundayClosed) closedDays.push('일');
  if (hours.holidaysClosed) closedDays.push('공휴일');
  if (closedDays.length > 0) parts.push(`${closedDays.join('·')} 휴무`);
  return parts.join(' · ');
}
