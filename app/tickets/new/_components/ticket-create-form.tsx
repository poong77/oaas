'use client';

/**
 * 3단계 이슈 접수 폼 — IC-01.
 *
 * Step 1: 무엇이 문제인가요?    — 제품·유형·긴급도
 * Step 2: 자세히 알려주세요     — 제목·내용·첨부
 * Step 3: 어떻게 연락드릴까요?  — SMS/Email + 본인정보 확인
 *
 * URL 쿼리 pre-fill:
 *   - ?type=error            → 유형 자동 선택
 *   - ?product=pms           → 제품 자동 선택
 *   - ?from=checklist&checklist=...&step=...  → 내용 상단에 컨텍스트 prepend
 */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  useEffect,
  useMemo,
  useState,
  useTransition,
  type FormEvent,
} from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  Flame,
  Mail,
  MessageSquare,
  Send,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { RichEditor } from '@/components/editor/rich-editor';
import { HotelierGuideButton } from '@/components/editor/placeholders/hotelier-guide';
import { createTicketAction } from '@/app/actions/ticket-actions';
import {
  AttachmentUploader,
  type UploadedAttachment,
} from './attachment-uploader';
import { cn } from '@/lib/utils';

type CategoryItem = {
  code: string;
  label: string;
  icon?: string | null;
};

type Viewer = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  hotelName: string | null;
};

export type TicketCreateFormProps = {
  viewer: Viewer;
  productCategories: CategoryItem[];
  issueTypeCategories: CategoryItem[];
  urgencyCategories: CategoryItem[];
  prefill?: {
    product?: string | null;
    type?: string | null;
    checklist?: string | null;
    step?: string | null;
    from?: string | null;
  };
};

const STEPS = [
  { key: 1, label: '문제 분류', description: '제품·유형·긴급도' },
  { key: 2, label: '자세한 내용', description: '제목·본문·첨부' },
  { key: 3, label: '연락 방법', description: 'SMS·이메일 선택' },
] as const;

export function TicketCreateForm(props: TicketCreateFormProps) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // 폼 상태
  const [productCode, setProductCode] = useState<string>(
    props.prefill?.product ?? '',
  );
  const [issueType, setIssueType] = useState<string>(
    props.prefill?.type === 'error'
      ? 'error'
      : (props.prefill?.type ?? ''),
  );
  const [urgency, setUrgency] = useState<string>('p2');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);
  const [contactMethods, setContactMethods] = useState<
    Array<'sms' | 'email'>
  >(() => {
    const init: Array<'sms' | 'email'> = [];
    if (props.viewer.email) init.push('email');
    if (props.viewer.phone) init.push('sms');
    return init.length > 0 ? init : ['email'];
  });

  // 체크리스트 / 챗봇 → 접수 흐름 컨텍스트 자동 prepend
  useEffect(() => {
    if (props.prefill?.from === 'checklist' && props.prefill.checklist) {
      const ctx = [
        '## 사전 진단 정보',
        `- 체크리스트 ID: \`${props.prefill.checklist}\``,
        props.prefill.step ? `- 분기 단계: ${props.prefill.step}` : null,
        '',
        '---',
        '',
      ]
        .filter(Boolean)
        .join('\n');
      setContent((prev) => (prev.startsWith('## 사전 진단') ? prev : ctx + prev));
    } else if (props.prefill?.from === 'chatbot') {
      // TODO(phase-8-temp): Phase 9+에서 chatbot_sessions 연동 시 conversation_id 포함
      const ctx = [
        '## 챗봇에서 해결되지 않은 문의',
        '- 챗봇 대화 요지 (가능하면 적어주세요):',
        '  - ',
        '',
        '---',
        '',
      ].join('\n');
      setContent((prev) => (prev.startsWith('## 챗봇') ? prev : ctx + prev));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function fieldError(name: string) {
    return fieldErrors[name];
  }

  function validateStep1(): boolean {
    const errs: Record<string, string> = {};
    if (!productCode) errs.productCode = '제품을 선택하세요';
    if (!issueType) errs.issueType = '유형을 선택하세요';
    if (!urgency) errs.urgency = '긴급도를 선택하세요';
    setFieldErrors((prev) => ({ ...prev, ...errs }));
    return Object.keys(errs).length === 0;
  }
  function validateStep2(): boolean {
    const errs: Record<string, string> = {};
    if (title.trim().length < 2) errs.title = '제목을 2자 이상 입력하세요';
    if (content.trim().length < 10)
      errs.content = '내용을 10자 이상 자세히 적어주세요';
    setFieldErrors((prev) => ({ ...prev, ...errs }));
    return Object.keys(errs).length === 0;
  }
  function validateStep3(): boolean {
    const errs: Record<string, string> = {};
    if (contactMethods.length === 0)
      errs.contactMethods = '최소 한 가지 연락수단을 선택하세요';
    if (contactMethods.includes('sms') && !props.viewer.phone)
      errs.contactMethods = '연락처가 등록되어 있지 않습니다. 프로필에서 추가 후 시도하세요.';
    if (contactMethods.includes('email') && !props.viewer.email)
      errs.contactMethods = '이메일이 등록되어 있지 않습니다.';
    setFieldErrors((prev) => ({ ...prev, ...errs }));
    return Object.keys(errs).length === 0;
  }

  function goNext() {
    setFieldErrors({});
    setServerError(null);
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    setStep((s) => (s === 3 ? 3 : ((s + 1) as 1 | 2 | 3)));
  }
  function goPrev() {
    setFieldErrors({});
    setServerError(null);
    setStep((s) => (s === 1 ? 1 : ((s - 1) as 1 | 2 | 3)));
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFieldErrors({});
    setServerError(null);
    if (!validateStep3()) return;

    const fd = new FormData();
    fd.append('productCode', productCode);
    fd.append('issueType', issueType);
    fd.append('urgency', urgency);
    fd.append('title', title.trim());
    fd.append('content', content.trim());
    for (const m of contactMethods) fd.append('contactMethods', m);
    fd.append('attachments', JSON.stringify(attachments));
    if (props.prefill?.from || props.prefill?.checklist) {
      fd.append(
        'customFields',
        JSON.stringify({
          from: props.prefill?.from ?? null,
          checklistId: props.prefill?.checklist ?? null,
          checklistStep: props.prefill?.step ?? null,
        }),
      );
    }

    startTransition(async () => {
      const result = await createTicketAction(undefined, fd);
      if (!result.ok) {
        setServerError(result.message ?? '접수에 실패했습니다');
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }
      if (result.ticketId) {
        router.push(`/tickets/${result.ticketId}?created=1`);
        router.refresh();
      }
    });
  }

  const stepperProgress = useMemo(() => ((step - 1) / 2) * 100, [step]);

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* 스텝퍼 */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          {STEPS.map((s) => {
            const active = s.key === step;
            const done = s.key < step;
            return (
              <div
                key={s.key}
                className="flex flex-1 flex-col items-center gap-1 text-center"
              >
                <div
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold',
                    active && 'bg-brand-600 text-white',
                    done && 'bg-emerald-500 text-white',
                    !active && !done &&
                      'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
                  )}
                >
                  {done ? <CheckCircle2 className="h-4 w-4" /> : s.key}
                </div>
                <div
                  className={cn(
                    'text-xs font-medium',
                    active
                      ? 'text-slate-900 dark:text-slate-100'
                      : 'text-slate-500 dark:text-slate-400',
                  )}
                >
                  {s.label}
                </div>
                <div className="hidden text-[11px] text-slate-400 sm:block">
                  {s.description}
                </div>
              </div>
            );
          })}
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
          <div
            className="h-full bg-brand-500 transition-all"
            style={{ width: `${stepperProgress}%` }}
          />
        </div>
      </div>

      {/* Step 1 — 제품·유형·긴급도 */}
      {step === 1 && (
        <Card>
          <CardContent className="flex flex-col gap-5 p-5 sm:p-6">
            <div>
              <SectionLabel
                required
                title="제품"
                error={fieldError('productCode')}
              />
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {props.productCategories.map((c) => (
                  <ChoiceCard
                    key={c.code}
                    label={c.label}
                    selected={productCode === c.code}
                    onClick={() => setProductCode(c.code)}
                  />
                ))}
              </div>
            </div>

            <div>
              <SectionLabel
                required
                title="유형"
                error={fieldError('issueType')}
              />
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {props.issueTypeCategories.map((c) => (
                  <ChoiceCard
                    key={c.code}
                    label={c.label}
                    selected={issueType === c.code}
                    onClick={() => setIssueType(c.code)}
                  />
                ))}
              </div>
            </div>

            <div>
              <SectionLabel
                required
                title="긴급도"
                error={fieldError('urgency')}
              />
              <div className="grid grid-cols-3 gap-2">
                {props.urgencyCategories.map((c) => (
                  <ChoiceCard
                    key={c.code}
                    label={c.label}
                    tone={
                      c.code === 'p1'
                        ? 'danger'
                        : c.code === 'p2'
                          ? 'warn'
                          : 'slate'
                    }
                    selected={urgency === c.code}
                    onClick={() => setUrgency(c.code)}
                    icon={c.code === 'p1' ? <Flame className="h-3.5 w-3.5" /> : null}
                  />
                ))}
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                P1은 영업에 즉각 영향을 주는 긴급 장애에만 사용하세요.
                선택 시 <code>#as-urgent</code>로 즉시 통지됩니다.
              </p>
            </div>

            <StepNav
              canGoBack={false}
              onNext={goNext}
              nextLabel="다음"
            />
          </CardContent>
        </Card>
      )}

      {/* Step 2 — 제목 / 본문 / 첨부 */}
      {step === 2 && (
        <Card>
          <CardContent className="flex flex-col gap-5 p-5 sm:p-6">
            <div>
              <SectionLabel
                required
                title="제목"
                error={fieldError('title')}
              />
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                placeholder="문제를 한 줄로 요약해주세요"
                disabled={pending}
              />
              <div className="mt-1 flex justify-end text-[11px] text-slate-400">
                {title.length} / 200
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <SectionLabel
                  required
                  title="자세한 내용"
                  error={fieldError('content')}
                />
                <HotelierGuideButton
                  variant="new-ticket"
                  hidden={!!content.trim()}
                  onApply={setContent}
                />
              </div>
              <RichEditor
                mode="full"
                value={content}
                onChange={setContent}
                minHeight={260}
                placeholder="언제부터 발생했나요? 재현 단계, 기대 결과, 시도해본 조치를 적어주세요."
                disabled={pending}
                autoSave={{
                  scope: 'ticket-message',
                  targetId: null,
                }}
              />
              <div className="mt-1 flex justify-between text-[11px] text-slate-400">
                <span>발생 시각·재현 단계·기대 결과를 적어주시면 처리가 빨라집니다.</span>
                <span>{content.length} / 20,000</span>
              </div>
            </div>

            <div>
              <SectionLabel title="첨부 (선택)" />
              <AttachmentUploader
                attachments={attachments}
                onChange={setAttachments}
                disabled={pending}
              />
            </div>

            <StepNav
              canGoBack
              onPrev={goPrev}
              onNext={goNext}
              nextLabel="다음"
            />
          </CardContent>
        </Card>
      )}

      {/* Step 3 — 연락방식 + 요약 */}
      {step === 3 && (
        <Card>
          <CardContent className="flex flex-col gap-5 p-5 sm:p-6">
            <div>
              <SectionLabel
                required
                title="연락 방법"
                error={fieldError('contactMethods')}
              />
              <div className="grid gap-2 sm:grid-cols-2">
                <ContactToggle
                  selected={contactMethods.includes('email')}
                  onToggle={() => toggleContact('email', contactMethods, setContactMethods)}
                  icon={<Mail className="h-4 w-4" />}
                  label="이메일"
                  detail={props.viewer.email ?? '이메일 미등록'}
                  disabled={!props.viewer.email || pending}
                />
                <ContactToggle
                  selected={contactMethods.includes('sms')}
                  onToggle={() => toggleContact('sms', contactMethods, setContactMethods)}
                  icon={<MessageSquare className="h-4 w-4" />}
                  label="SMS"
                  detail={props.viewer.phone ?? '연락처 미등록'}
                  disabled={!props.viewer.phone || pending}
                />
              </div>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                접수 확인과 처리 상태(처리중·완료)가 선택한 방법으로 발송됩니다. 정보가 비어있다면{' '}
                <Link href="/profile" className="text-brand-600 underline">
                  프로필
                </Link>
                에서 먼저 등록해주세요.
              </p>
            </div>

            {/* 요약 */}
            <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-900/40">
              <div className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                접수 요약
              </div>
              <SummaryRow
                label="호텔"
                value={props.viewer.hotelName ?? '호텔 미매핑'}
              />
              <SummaryRow label="접수자" value={props.viewer.name ?? '-'} />
              <SummaryRow
                label="제품 · 유형"
                value={`${labelOf(props.productCategories, productCode)} · ${labelOf(props.issueTypeCategories, issueType)}`}
              />
              <SummaryRow
                label="긴급도"
                value={labelOf(props.urgencyCategories, urgency)}
                badge={
                  urgency === 'p1'
                    ? { tone: 'danger', text: 'P1' }
                    : urgency === 'p2'
                      ? { tone: 'warn', text: 'P2' }
                      : { tone: 'slate', text: 'P3' }
                }
              />
              <SummaryRow label="제목" value={title} />
              <SummaryRow
                label="첨부"
                value={`${attachments.length}개${
                  attachments.length > 0
                    ? ` · ${formatTotalSize(attachments)}`
                    : ''
                }`}
              />
            </div>

            {serverError && (
              <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{serverError}</span>
              </div>
            )}

            <StepNav
              canGoBack
              onPrev={goPrev}
              submit
              submitLabel="접수하기"
              loading={pending}
            />
          </CardContent>
        </Card>
      )}
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────
// 보조 컴포넌트
// ─────────────────────────────────────────────────────────────────────

function SectionLabel({
  title,
  required,
  error,
}: {
  title: string;
  required?: boolean;
  error?: string;
}) {
  return (
    <div className="mb-1.5 flex items-center justify-between">
      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
        {title}
        {required && <span className="ml-1 text-red-500">*</span>}
      </span>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}

function ChoiceCard({
  label,
  selected,
  onClick,
  tone = 'slate',
  icon,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  tone?: 'slate' | 'warn' | 'danger';
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium transition-colors',
        selected
          ? tone === 'danger'
            ? 'border-red-300 bg-red-50 text-red-700 ring-2 ring-red-300 dark:border-red-700 dark:bg-red-950/40 dark:text-red-200 dark:ring-red-700'
            : tone === 'warn'
              ? 'border-amber-300 bg-amber-50 text-amber-800 ring-2 ring-amber-300 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-700'
              : 'border-brand-400 bg-brand-50 text-brand-700 ring-2 ring-brand-300 dark:border-brand-700 dark:bg-brand-950/40 dark:text-brand-300 dark:ring-brand-700'
          : 'border-slate-200 bg-white text-slate-700 hover:border-brand-300 hover:bg-brand-50/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-brand-700 dark:hover:bg-brand-950/20',
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function StepNav({
  canGoBack,
  onPrev,
  onNext,
  nextLabel,
  submit,
  submitLabel,
  loading,
}: {
  canGoBack: boolean;
  onPrev?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  submit?: boolean;
  submitLabel?: string;
  loading?: boolean;
}) {
  return (
    <div className="mt-1 flex items-center justify-between gap-2">
      {canGoBack ? (
        <Button
          type="button"
          variant="ghost"
          onClick={onPrev}
          disabled={loading}
        >
          <ArrowLeft className="h-4 w-4" />
          이전
        </Button>
      ) : (
        <Link
          href="/help"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          제품별 가이드
        </Link>
      )}
      {submit ? (
        <Button type="submit" size="lg" disabled={loading}>
          {loading ? '접수 중...' : submitLabel}
          {!loading && <Send className="h-4 w-4" />}
        </Button>
      ) : (
        <Button type="button" size="lg" onClick={onNext}>
          {nextLabel ?? '다음'}
          <ArrowRight className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

function ContactToggle({
  selected,
  onToggle,
  icon,
  label,
  detail,
  disabled,
}: {
  selected: boolean;
  onToggle: () => void;
  icon: React.ReactNode;
  label: string;
  detail: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={cn(
        'flex items-start gap-3 rounded-md border px-3 py-2 text-left text-sm transition-colors',
        selected
          ? 'border-brand-400 bg-brand-50 ring-2 ring-brand-300 dark:border-brand-700 dark:bg-brand-950/40 dark:ring-brand-700'
          : 'border-slate-200 bg-white hover:border-brand-300 hover:bg-brand-50/30 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-brand-700 dark:hover:bg-brand-950/20',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      <div
        className={cn(
          'mt-0.5 rounded-md p-1.5',
          selected
            ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/60 dark:text-brand-300'
            : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
        )}
      >
        {icon}
      </div>
      <div className="flex-1">
        <div className="font-medium text-slate-800 dark:text-slate-100">
          {label}
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400">
          {detail}
        </div>
      </div>
      {selected && <BadgeCheck className="h-4 w-4 text-brand-500" />}
    </button>
  );
}

function SummaryRow({
  label,
  value,
  badge,
}: {
  label: string;
  value: string;
  badge?: { tone: 'slate' | 'warn' | 'danger'; text: string };
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-200 py-1.5 text-sm last:border-b-0 dark:border-slate-700">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className="flex items-center gap-2 text-right font-medium text-slate-800 dark:text-slate-100">
        {badge && <Badge tone={badge.tone}>{badge.text}</Badge>}
        {value}
      </span>
    </div>
  );
}

function toggleContact(
  m: 'sms' | 'email',
  current: Array<'sms' | 'email'>,
  set: (next: Array<'sms' | 'email'>) => void,
) {
  set(current.includes(m) ? current.filter((v) => v !== m) : [...current, m]);
}

function labelOf(list: CategoryItem[], code: string): string {
  return list.find((x) => x.code === code)?.label ?? code ?? '—';
}

function formatTotalSize(items: UploadedAttachment[]): string {
  const total = items.reduce((s, a) => s + a.sizeBytes, 0);
  if (total < 1024) return `${total} B`;
  if (total < 1024 * 1024) return `${(total / 1024).toFixed(1)} KB`;
  return `${(total / 1024 / 1024).toFixed(1)} MB`;
}
