'use client';

/**
 * 이슈 접수 폼 — IC-01 (major-overhaul P6: 3단계 → 1페이지).
 *
 * 한 화면: 제목 · 자세한 내용(템플릿/AI 분류) · 제품 · 요청유형 · 연락방법 · 첨부.
 * - 제품/요청유형: 옵션값, 기본 '미정'(미선택 시 기타>일반 / 기타로 접수).
 * - 긴급도·접수요약 제거. 연락방법 이메일 기본.
 * - AI 분류: 제목·내용으로 제품/유형 자동 추론.
 * - 제품 분류: 호텔리어=대분류만(root-only), 매니저·어드민=대/중/소(cascade) — ProductPicker.
 *
 * URL 쿼리 pre-fill: ?type=, ?product=, ?from=checklist&checklist=&step=
 */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition, type FormEvent } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  BadgeCheck,
  FileText,
  Mail,
  MessageSquare,
  Send,
  Sparkles,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { RichEditor } from '@/components/editor/rich-editor';
import { HotelierGuideButton } from '@/components/editor/placeholders/hotelier-guide';
import { toast } from 'sonner';
import {
  classifyTicketDraftAction,
  createTicketAction,
} from '@/app/actions/ticket-actions';
import type { ProductTaxonomyNode } from '@/lib/services/master-categories';
import {
  ProductPicker,
  type ProductPickerMode,
} from '@/components/forms/product-picker';
import {
  AttachmentUploader,
  type UploadedAttachment,
} from './attachment-uploader';
import { cn } from '@/lib/utils';

type Option = { code: string; label: string };
type TemplateItem = {
  id: string;
  title: string;
  content: string;
  category: string | null;
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
  productTree: ProductTaxonomyNode[];
  /** 호텔리어=대분류만(root-only), 매니저·어드민=대/중/소(cascade). */
  productMode: ProductPickerMode;
  issueTypeCategories: Option[];
  templates: TemplateItem[];
  prefill?: {
    product?: string | null;
    type?: string | null;
    checklist?: string | null;
    step?: string | null;
    from?: string | null;
  };
};

/** 미선택 시 기본 코드 (기타 > 일반 / 기타). */
const DEFAULT_PRODUCT = 'etc_general';
const DEFAULT_ISSUE = 'etc';

export function TicketCreateForm(props: TicketCreateFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [classifying, startClassify] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [templateOpen, setTemplateOpen] = useState(false);

  const [productCode, setProductCode] = useState<string>(
    props.prefill?.product ?? '',
  );
  const [issueType, setIssueType] = useState<string>(props.prefill?.type ?? '');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);
  const [contactMethods, setContactMethods] = useState<Array<'sms' | 'email'>>(
    () => {
      const init: Array<'sms' | 'email'> = [];
      if (props.viewer.email) init.push('email'); // 이메일 기본
      if (props.viewer.phone) init.push('sms');
      return init.length > 0 ? init : ['email'];
    },
  );

  // 체크리스트/챗봇 → 컨텍스트 자동 prepend
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

  function applyTemplate(t: TemplateItem) {
    setContent((prev) =>
      prev.trim().length === 0 ? t.content : `${prev}\n\n${t.content}`,
    );
    setTemplateOpen(false);
    toast.success(`'${t.title}' 템플릿을 넣었습니다`);
  }

  function runAiClassify() {
    if (title.trim().length + content.trim().length < 5) {
      toast.error('제목·내용을 먼저 입력해주세요');
      return;
    }
    startClassify(async () => {
      const res = await classifyTicketDraftAction({ title, content });
      if (!res.ok) {
        toast.error(res.message ?? 'AI 분류 실패');
        return;
      }
      if (res.productCode) setProductCode(res.productCode);
      if (res.issueType) setIssueType(res.issueType);
      toast.success('AI가 제품·유형을 채웠습니다. 확인 후 수정하세요.');
    });
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFieldErrors({});
    setServerError(null);

    const errs: Record<string, string> = {};
    if (title.trim().length < 2) errs.title = '제목을 2자 이상 입력하세요';
    if (content.trim().length < 10)
      errs.content = '내용을 10자 이상 자세히 적어주세요';
    if (contactMethods.length === 0)
      errs.contactMethods = '최소 한 가지 연락수단을 선택하세요';
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    const fd = new FormData();
    fd.append('productCode', productCode || DEFAULT_PRODUCT);
    fd.append('issueType', issueType || DEFAULT_ISSUE);
    fd.append('urgency', 'p2'); // 긴급도 UI 제거 — 기본 P2 (어드민이 추후 조정)
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

  const busy = pending || classifying;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <Card>
        <CardContent className="flex flex-col gap-5 p-5 sm:p-6">
          {/* 제목 */}
          <div>
            <SectionLabel required title="제목" error={fieldErrors.title} />
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              placeholder="문제를 한 줄로 요약해주세요"
              disabled={busy}
            />
          </div>

          {/* 자세한 내용 + 템플릿 */}
          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <SectionLabel required title="자세한 내용" error={fieldErrors.content} />
              <div className="flex items-center gap-1.5">
                {props.templates.length > 0 && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setTemplateOpen((v) => !v)}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 transition hover:border-brand-300 hover:text-brand-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      템플릿
                    </button>
                    {templateOpen && (
                      <div className="absolute right-0 z-20 mt-1 max-h-72 w-64 overflow-auto rounded-md border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
                        {props.templates.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => applyTemplate(t)}
                            className="flex w-full flex-col items-start gap-0.5 rounded px-2 py-1.5 text-left hover:bg-brand-50 dark:hover:bg-brand-950/30"
                          >
                            <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
                              {t.title}
                            </span>
                            {t.category && (
                              <span className="text-[11px] text-slate-400">
                                {t.category}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <HotelierGuideButton
                  variant="new-ticket"
                  hidden={!!content.trim()}
                  onApply={setContent}
                />
              </div>
            </div>
            <RichEditor
              mode="full"
              value={content}
              onChange={setContent}
              minHeight={240}
              placeholder="언제부터 발생했나요? 재현 단계, 기대 결과, 시도해본 조치를 적어주세요."
              disabled={busy}
              autoSave={{ scope: 'ticket-message', targetId: null }}
            />
            <div className="mt-1 text-[11px] text-slate-400">
              발생 시각·재현 단계·기대 결과를 적어주시면 처리가 빨라집니다.
            </div>
          </div>

          {/* 제품 / 요청유형 (옵션, 기본 미정) + AI 분류 */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <SectionLabel title="제품" />
                <button
                  type="button"
                  onClick={runAiClassify}
                  disabled={busy}
                  className="inline-flex items-center gap-1 rounded-md border border-brand-200 bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700 transition hover:bg-brand-100 disabled:opacity-60 dark:border-brand-800 dark:bg-brand-950/40 dark:text-brand-300"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {classifying ? '분류 중...' : 'AI 분류'}
                </button>
              </div>
              <ProductPicker
                tree={props.productTree}
                value={productCode}
                onChange={setProductCode}
                disabled={busy}
                mode={props.productMode}
                undefinedLabel="미정 (선택 안 함 · AI 분류 가능)"
              />
              {props.productMode === 'cascade' && (
                <p className="mt-1 text-[11px] text-slate-400">
                  대분류 선택 후 중·소분류가 있으면 추가로 지정할 수 있습니다.
                </p>
              )}
            </div>
            <div>
              <SectionLabel title="요청유형" />
              <Select
                value={issueType}
                onChange={(e) => setIssueType(e.target.value)}
                disabled={busy}
              >
                <option value="">미정</option>
                {props.issueTypeCategories.map((o) => (
                  <option key={o.code} value={o.code}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {/* 연락 방법 */}
          <div>
            <SectionLabel
              required
              title="연락 방법"
              error={fieldErrors.contactMethods}
            />
            <div className="grid gap-2 sm:grid-cols-2">
              <ContactToggle
                selected={contactMethods.includes('email')}
                onToggle={() => toggleContact('email', contactMethods, setContactMethods)}
                icon={<Mail className="h-4 w-4" />}
                label="이메일"
                detail={props.viewer.email ?? '이메일 미등록'}
                disabled={!props.viewer.email || busy}
              />
              <ContactToggle
                selected={contactMethods.includes('sms')}
                onToggle={() => toggleContact('sms', contactMethods, setContactMethods)}
                icon={<MessageSquare className="h-4 w-4" />}
                label="SMS"
                detail={props.viewer.phone ?? '연락처 미등록'}
                disabled={!props.viewer.phone || busy}
              />
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              접수 확인·처리 상태가 선택한 방법으로 발송됩니다. 정보가 비어있다면{' '}
              <Link href="/profile" className="text-brand-600 underline">
                프로필
              </Link>
              에서 먼저 등록해주세요.
            </p>
          </div>

          {/* 첨부 */}
          <div>
            <SectionLabel title="첨부 (선택)" />
            <AttachmentUploader
              attachments={attachments}
              onChange={setAttachments}
              disabled={busy}
            />
          </div>

          {serverError && (
            <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{serverError}</span>
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <Link
              href="/help"
              className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              제품별 가이드
            </Link>
            <Button type="submit" size="lg" disabled={busy}>
              {pending ? '접수 중...' : '접수하기'}
              {!pending && <Send className="h-4 w-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}

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
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
        {title}
        {required && <span className="ml-1 text-red-500">*</span>}
      </span>
      {error && <span className="text-xs text-red-500">{error}</span>}
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
        <div className="text-xs text-slate-500 dark:text-slate-400">{detail}</div>
      </div>
      {selected && <BadgeCheck className="h-4 w-4 text-brand-500" />}
    </button>
  );
}

function toggleContact(
  m: 'sms' | 'email',
  current: Array<'sms' | 'email'>,
  set: (next: Array<'sms' | 'email'>) => void,
) {
  set(current.includes(m) ? current.filter((v) => v !== m) : [...current, m]);
}
