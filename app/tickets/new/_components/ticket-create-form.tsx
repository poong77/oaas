'use client';

/**
 * 이슈 접수 폼 — IC-01 (시안 스타일 적용, 2026-06-10).
 *
 * 시안대로: 섹션 카드(문제분류 / 상세 내용 / 연락 방법) + 칩 선택 + 큰 입력.
 * 로직은 보존 — createTicketAction·AttachmentUploader(실 S3)·검증·연락수단·템플릿.
 * 제품/요청유형은 실데이터(productTree 대분류 / issueTypeCategories)를 칩으로 렌더.
 *
 * URL 쿼리 pre-fill: ?type=, ?product=, ?from=checklist&checklist=&step=
 */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useState,
  useTransition,
  type FormEvent,
} from 'react';
import { AlertCircle, Mail, MessageSquare, Check } from 'lucide-react';
import { toast } from 'sonner';
import { createTicketAction } from '@/app/actions/ticket-actions';
import type { ProductTaxonomyNode } from '@/lib/services/master-categories';
import {
  AttachmentUploader,
  type UploadedAttachment,
} from './attachment-uploader';
import { RichEditor } from '@/components/editor/rich-editor';
import {
  SaveIndicator,
  type SaveStatus,
} from '@/components/editor/panels/save-indicator';
import { generateDraftNonce, makeDraftKey } from '@/lib/editor/draft-key';
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
  /** 호텔리어=대분류만(root-only), 매니저·어드민=대/중/소 — 시안에선 대분류 칩으로 단순화. */
  productMode: 'root-only' | 'cascade';
  issueTypeCategories: Option[];
  hotelierTemplates: TemplateItem[];
  prefill?: {
    product?: string | null;
    type?: string | null;
    checklist?: string | null;
    step?: string | null;
    from?: string | null;
  };
};

const DEFAULT_PRODUCT = 'etc_general';
const DEFAULT_ISSUE = 'etc';
const MAX_CONTENT = 20000;

// 신규 접수는 targetId(UUID)가 없어 nonce 기반 draft를 쓴다.
// nonce를 localStorage에 고정해 새로고침/실수 이탈 후 재진입 시에도 복구되게 한다.
const NEW_TICKET_NONCE_LS_KEY = 'ticket-new:nonce';
const DRAFT_LS_PREFIX = 'editor-draft:';

function readOrCreateNewTicketNonce(): string {
  if (typeof window === 'undefined') return generateDraftNonce();
  try {
    const existing = localStorage.getItem(NEW_TICKET_NONCE_LS_KEY);
    if (existing && /^[a-zA-Z0-9]{6,24}$/.test(existing)) return existing;
    const n = generateDraftNonce();
    localStorage.setItem(NEW_TICKET_NONCE_LS_KEY, n);
    return n;
  } catch {
    return generateDraftNonce();
  }
}

/** 발행 성공 후 신규 접수 draft 정리 (localStorage + 서버 + nonce 키). best-effort. */
async function clearNewTicketDraft(nonce: string): Promise<void> {
  let key: string;
  try {
    key = makeDraftKey('ticket-message', null, nonce);
  } catch {
    return;
  }
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(`${DRAFT_LS_PREFIX}${key}`);
      localStorage.removeItem(NEW_TICKET_NONCE_LS_KEY);
    } catch {
      /* noop */
    }
  }
  try {
    await fetch(`/api/drafts?key=${encodeURIComponent(key)}`, {
      method: 'DELETE',
      cache: 'no-store',
    });
  } catch {
    /* noop — 30일 cron으로 정리됨 */
  }
}

export function TicketCreateForm(props: TicketCreateFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  // 접수 성공 시 안내 팝업 노출 (시안 반영). 닫으면 내 문의 목록으로.
  const [submitted, setSubmitted] = useState(false);

  // 작성 중 자동저장 상태
  const [draftNonce] = useState(readOrCreateNewTicketNonce);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const handleAutosaveStatus = useCallback(
    (status: SaveStatus, lastSavedAt: number | null) => {
      setSaveStatus(status);
      setSavedAt(lastSavedAt);
    },
    [],
  );

  // 대분류 칩 목록 (실데이터)
  const products: Option[] = props.productTree.map((n) => ({
    code: n.code,
    label: n.label,
  }));
  // 프로그램/상세유형: 기본 미선택 · 필수 아님. 미선택 제출 시 액션에서 '기타'로 분류.
  const [productCode, setProductCode] = useState<string>(
    props.prefill?.product ?? '',
  );
  const [issueType, setIssueType] = useState<string>(
    props.prefill?.type ?? '',
  );
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);
  // 발송 방법 — 등록된 수단 기준 기본 선택(이메일 우선). 둘 다 없으면 이메일.
  const [contactMethods, setContactMethods] = useState<Array<'sms' | 'email'>>(
    () =>
      props.viewer.email
        ? ['email']
        : props.viewer.phone
          ? ['sms']
          : ['email'],
  );

  useEffect(() => {
    if (props.prefill?.from === 'checklist' && props.prefill.checklist) {
      const ctx = [
        '## 사전 진단 정보',
        `- 체크리스트 ID: ${props.prefill.checklist}`,
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
    const block = normalizeTemplate(t.content);
    setContent((prev) =>
      prev.trim().length === 0
        ? block
        : `${prev}\n\n${block}`.slice(0, MAX_CONTENT),
    );
    toast.success(`'${t.title}' 템플릿을 넣었습니다`);
  }

  function toggleContact(m: 'sms' | 'email') {
    setContactMethods((cur) =>
      cur.includes(m) ? cur.filter((v) => v !== m) : [...cur, m],
    );
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFieldErrors({});
    setServerError(null);

    const errs: Record<string, string> = {};
    if (title.trim().length < 2) errs.title = '제목을 2자 이상 입력하세요';
    if (content.trim().length < 10)
      errs.content = '내용을 10자 이상 자세히 적어주세요';
    else if (content.trim().length > MAX_CONTENT)
      errs.content = `내용이 너무 깁니다 (최대 ${MAX_CONTENT.toLocaleString()}자)`;
    if (contactMethods.length === 0)
      errs.contactMethods = '최소 한 가지 연락수단을 선택하세요';
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    const fd = new FormData();
    fd.append('productCode', productCode || DEFAULT_PRODUCT);
    fd.append('issueType', issueType || DEFAULT_ISSUE);
    fd.append('urgency', 'p2');
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
        void clearNewTicketDraft(draftNonce);
        setSubmitted(true);
      }
    });
  }

  const busy = pending;
  const sectionCls =
    'flex flex-col gap-6 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 sm:p-8';
  const labelCls =
    'flex items-center gap-0.5 text-base font-medium text-slate-800 dark:text-slate-100';

  return (
    <>
    <form
      onSubmit={handleSubmit}
      className="mx-auto flex w-full max-w-[820px] flex-col gap-8"
    >
      <h1 className="text-center text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-[36px]">
        문의하기
      </h1>

      {/* ① 문제분류 */}
      <section className={sectionCls}>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          문제분류
        </h2>

        <div className="flex flex-col gap-2">
          <span className={labelCls}>
            문의 프로그램
            <span className="ml-1 text-xs font-normal text-slate-400">선택 (미선택 시 기타)</span>
          </span>
          <div className="flex flex-wrap gap-2">
            {products.map((p) => (
              <Chip
                key={p.code}
                label={p.label}
                selected={productCode === p.code}
                onClick={() => setProductCode(p.code)}
                disabled={busy}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className={labelCls}>
            상세 유형
            <span className="ml-1 text-xs font-normal text-slate-400">선택 (미선택 시 기타)</span>
          </span>
          <div className="flex flex-wrap gap-2">
            {props.issueTypeCategories.map((d) => (
              <Chip
                key={d.code}
                label={d.label}
                selected={issueType === d.code}
                onClick={() => setIssueType(d.code)}
                disabled={busy}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ② 상세 내용 */}
      <section className={sectionCls}>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          상세 내용
        </h2>

        <div className="flex flex-col gap-2">
          <span className={labelCls}>
            제목 <Req />
          </span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            disabled={busy}
            placeholder="문제를 한 줄로 요약해주세요"
            className="h-[52px] w-full rounded-lg border border-[#dcdee3] bg-white px-4 text-base leading-[1.48] text-[#1a1c20] placeholder:text-[#8b8f9a] focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600/30 dark:border-slate-600 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-500"
          />
          {fieldErrors.title && (
            <span className="text-xs text-red-500">{fieldErrors.title}</span>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className={labelCls}>
              상세 내용 <Req />
            </span>
            {props.hotelierTemplates.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                {props.hotelierTemplates.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => applyTemplate(t)}
                    disabled={busy}
                    title={`'${t.title}' 템플릿 채우기`}
                    className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-600 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                  >
                    {t.title}
                  </button>
                ))}
              </div>
            )}
          </div>
          <RichEditor
            mode="lite"
            value={content}
            onChange={setContent}
            disabled={busy}
            minHeight={300}
            placeholder="언제부터 발생했나요? 재현 단계, 기대 결과, 시도해본 조치를 적어주세요."
            autoSave={{
              scope: 'ticket-message',
              targetId: null,
              nonce: draftNonce,
            }}
            onAutosaveStatusChange={handleAutosaveStatus}
          />
          <div className="flex items-center justify-between">
            {fieldErrors.content ? (
              <span className="text-xs text-red-500">{fieldErrors.content}</span>
            ) : (
              <span className="text-xs text-slate-400">
                발생 시각·재현 단계·기대 결과를 적어주시면 처리가 빨라집니다.
              </span>
            )}
            <div className="flex items-center gap-3">
              <SaveIndicator status={saveStatus} lastSavedAt={savedAt} />
              <span className="text-sm text-slate-400">
                {content.length.toLocaleString()} /{' '}
                {MAX_CONTENT.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className={labelCls}>첨부 파일</span>
          <AttachmentUploader
            attachments={attachments}
            onChange={setAttachments}
            disabled={busy}
          />
        </div>
      </section>

      {/* ③ 연락 방법 */}
      <section className={sectionCls}>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          연락 방법
        </h2>
        <div className="flex flex-col gap-2">
          <span className={labelCls}>
            발송 방법 <Req />
          </span>
          <div className="flex flex-col gap-4 sm:flex-row">
            <ContactOption
              Icon={Mail}
              label="이메일"
              value={props.viewer.email ?? '이메일 미등록'}
              selected={contactMethods.includes('email')}
              onClick={() => toggleContact('email')}
              disabled={!props.viewer.email || busy}
            />
            <ContactOption
              Icon={MessageSquare}
              label="SMS"
              value={props.viewer.phone ?? '연락처 미등록'}
              selected={contactMethods.includes('sms')}
              onClick={() => toggleContact('sms')}
              disabled={!props.viewer.phone || busy}
            />
          </div>
          {fieldErrors.contactMethods ? (
            <span className="text-xs text-red-500">
              {fieldErrors.contactMethods}
            </span>
          ) : (
            <span className="text-sm text-slate-500 dark:text-slate-400">
              접수 확인·처리 상태가 선택한 방법으로 발송됩니다. 정보가 비어있다면{' '}
              <Link href="/profile" className="text-brand-600 underline">
                프로필
              </Link>
              에서 먼저 등록해주세요.
            </span>
          )}
        </div>
      </section>

      {serverError && (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{serverError}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-lg bg-brand-600 py-3.5 text-base font-semibold text-white transition-colors hover:bg-brand-500 disabled:opacity-60"
      >
        {pending ? '접수 중...' : '접수하기'}
      </button>
    </form>

    {/* 접수 완료 안내 팝업 (시안 반영) */}
    {submitted && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
        <div className="flex w-full max-w-[420px] flex-col gap-6 rounded-2xl bg-white p-7 text-center shadow-[0px_2px_10px_0px_rgba(0,0,0,0.1)] dark:bg-slate-900">
          <div className="flex flex-col gap-1.5">
            <h3 className="text-lg font-bold text-[#1A1C20] dark:text-white">
              문의가 접수되었어요
            </h3>
            <p className="text-sm text-[#555D6D] dark:text-slate-300">
              빠른 시간 내에 답변드리겠습니다.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                router.push('/tickets');
                router.refresh();
              }}
              className="flex-1 rounded-lg bg-[#E6F7F0] py-3 text-sm font-semibold text-[#00A36B] transition-colors hover:bg-[#d6f0e6]"
            >
              내 문의 목록
            </button>
            <button
              type="button"
              onClick={() => {
                router.push('/');
                router.refresh();
              }}
              className="flex-1 rounded-lg bg-[#F3F4F5] py-3 text-sm font-semibold text-[#555D6D] transition-colors hover:bg-[#e9eaec] dark:bg-slate-800 dark:text-slate-200"
            >
              홈으로
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────

/**
 * 템플릿(마크다운)을 본문에 삽입할 형태로 정리.
 *
 * 굵은 라벨(**라벨**)은 그대로 보존해 상세 화면에서 스타일이 살아있게 하고,
 * 각 항목을 빈 줄(\n\n)로 분리한다. 마크다운은 단일 줄바꿈(\n)을 공백으로
 * 접어버리므로, 빈 줄로 분리해야 항목별 줄바꿈이 보존된다.
 */
function normalizeTemplate(md: string): string {
  return md
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n\n');
}

function Req() {
  return <span className="text-red-500">*</span>;
}

function Chip({
  label,
  selected,
  onClick,
  disabled,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors disabled:opacity-50',
        selected
          ? 'border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-600 dark:bg-brand-950/40 dark:text-brand-300'
          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800',
      )}
    >
      {selected && <Check className="h-3.5 w-3.5 shrink-0" />}
      {label}
    </button>
  );
}

function ContactOption({
  Icon,
  label,
  value,
  selected,
  onClick,
  disabled,
}: {
  Icon: typeof Mail;
  label: string;
  value: string;
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        'flex flex-1 items-center gap-3 rounded-lg border px-5 py-3.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        selected
          ? 'border-brand-500 bg-brand-50 dark:border-brand-600 dark:bg-brand-950/40'
          : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800',
      )}
    >
      <Icon
        className={cn(
          'h-6 w-6 shrink-0',
          selected ? 'text-brand-600 dark:text-brand-300' : 'text-slate-400',
        )}
      />
      <span className="flex flex-1 flex-col">
        <span className="text-base font-medium text-slate-900 dark:text-white">
          {label}
        </span>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {value}
        </span>
      </span>
      <span
        className={cn(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors',
          selected ? 'border-brand-600 bg-brand-600' : 'border-slate-300',
        )}
      >
        {selected && <Check className="h-3.5 w-3.5 text-white" />}
      </span>
    </button>
  );
}
