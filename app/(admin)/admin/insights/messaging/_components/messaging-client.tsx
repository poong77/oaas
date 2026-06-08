'use client';

/**
 * 메일&문자 발송 클라이언트 (P7).
 *
 * 탭: 메일(SES) / 문자(Solapi). 공용 수신자 선택(호텔 검색 → 연락처 추가 + 직접 입력).
 * 메일: 제목·본문(RichEditor)·AI 작성. 문자: 본문(글자수·SMS/LMS·예상비용).
 * 발송 전 확인 다이얼로그. 실제 운영 발송이므로 주의 문구 표시.
 */

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  AlertTriangle,
  Check,
  Clipboard,
  History,
  Mail,
  MessageSquare,
  RefreshCw,
  Search,
  Sparkles,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { RichEditor } from '@/components/editor/rich-editor';
import { useConfirmDialog } from '@/components/dialogs/confirm-dialog';
import {
  aiWriteEmailAction,
  getHotelContactsAction,
  listMessagingHistoryAction,
  sendBulkEmailAction,
  sendBulkSmsAction,
  type MessagingHistoryItem,
} from '@/app/actions/messaging-actions';

type Tab = 'mail' | 'sms' | 'history';
type HotelHit = { id: string; name: string };

function parseRecipients(raw: string): string[] {
  return [
    ...new Set(
      raw
        .split(/[\n,;]+/)
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];
}

/** 한국형 바이트 길이 (한글 2, 그 외 1). */
function byteLength(s: string): number {
  let n = 0;
  for (const ch of s) n += ch.charCodeAt(0) > 0x7f ? 2 : 1;
  return n;
}

export function MessagingClient({
  senderEmail,
  senderPhone,
}: {
  senderEmail: string;
  senderPhone: string;
}) {
  const [tab, setTab] = useState<Tab>('mail');

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-700">
        <TabButton active={tab === 'mail'} onClick={() => setTab('mail')} icon={<Mail className="h-4 w-4" />}>
          메일 발송
        </TabButton>
        <TabButton active={tab === 'sms'} onClick={() => setTab('sms')} icon={<MessageSquare className="h-4 w-4" />}>
          문자 발송
        </TabButton>
        <TabButton active={tab === 'history'} onClick={() => setTab('history')} icon={<History className="h-4 w-4" />}>
          지난 이력
        </TabButton>
      </div>

      {tab === 'mail' ? (
        <MailTab senderEmail={senderEmail} />
      ) : tab === 'sms' ? (
        <SmsTab senderPhone={senderPhone} />
      ) : (
        <HistoryTab />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        '-mb-px inline-flex items-center gap-1.5 border-b-2 px-4 py-2 text-sm font-medium transition-colors ' +
        (active
          ? 'border-brand-500 text-brand-700 dark:border-brand-400 dark:text-brand-300'
          : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100')
      }
    >
      {icon}
      {children}
    </button>
  );
}

// ── 공용 수신자 선택 ──────────────────────────────────────────────
function RecipientPicker({
  mode,
  value,
  onChange,
}: {
  mode: 'email' | 'phone';
  value: string;
  onChange: (v: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<HotelHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [contacts, setContacts] = useState<string[] | null>(null);
  const [pickedHotel, setPickedHotel] = useState<string | null>(null);

  async function searchHotels() {
    if (query.trim().length === 0) return;
    setSearching(true);
    try {
      const res = await fetch(
        `/api/admin/hotels?q=${encodeURIComponent(query.trim())}`,
        { cache: 'no-store' },
      );
      const json = (await res.json()) as { ok: boolean; items?: HotelHit[] };
      setHits(json.ok ? (json.items ?? []) : []);
    } catch {
      toast.error('호텔 검색 실패');
    } finally {
      setSearching(false);
    }
  }

  async function pickHotel(h: HotelHit) {
    setPickedHotel(h.name);
    setHits([]);
    setQuery(h.name);
    const res = await getHotelContactsAction(h.id);
    if (!res.ok) {
      toast.error(res.message ?? '연락처 조회 실패');
      setContacts([]);
      return;
    }
    setContacts(mode === 'email' ? (res.emails ?? []) : (res.phones ?? []));
  }

  function addOne(c: string) {
    const cur = parseRecipients(value);
    if (cur.includes(c)) return;
    onChange([...cur, c].join('\n'));
  }
  function addAll() {
    if (!contacts) return;
    const merged = [...new Set([...parseRecipients(value), ...contacts])];
    onChange(merged.join('\n'));
    toast.success(`${contacts.length}건 추가`);
  }

  const count = parseRecipients(value).length;

  return (
    <div className="flex flex-col gap-2">
      <Label className="text-xs">
        수신자 ({mode === 'email' ? '이메일' : '전화번호'}) · {count}명
      </Label>
      {/* 호텔 검색 → 연락처 추가 */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void searchHotels();
              }
            }}
            placeholder="호텔명으로 연락처 불러오기"
            className="h-9 pl-8"
          />
          {hits.length > 0 && (
            <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
              {hits.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => pickHotel(h)}
                  className="block w-full px-3 py-1.5 text-left text-sm hover:bg-brand-50 dark:hover:bg-brand-950/30"
                >
                  {h.name}
                </button>
              ))}
            </div>
          )}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={searchHotels} disabled={searching}>
          {searching ? '검색…' : '검색'}
        </Button>
      </div>

      {contacts && (
        <div className="rounded-md border border-slate-200 p-2 dark:border-slate-700">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              {pickedHotel} · 연락처 {contacts.length}건
            </span>
            {contacts.length > 0 && (
              <button
                type="button"
                onClick={addAll}
                className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
              >
                전체 추가
              </button>
            )}
          </div>
          {contacts.length === 0 ? (
            <p className="text-xs text-slate-400">등록된 연락처가 없습니다.</p>
          ) : (
            <div className="flex flex-wrap gap-1">
              {contacts.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => addOne(c)}
                  className="rounded-full border border-slate-200 px-2 py-0.5 text-xs hover:border-brand-300 hover:bg-brand-50 dark:border-slate-700 dark:hover:bg-brand-950/30"
                >
                  + {c}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        placeholder={
          mode === 'email'
            ? '이메일 주소를 줄바꿈/쉼표로 구분해 입력하거나 위에서 추가하세요'
            : '전화번호를 줄바꿈/쉼표로 구분해 입력하거나 위에서 추가하세요'
        }
        className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900"
      />
    </div>
  );
}

function WarningBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

function ReasonInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-xs">발송 사유 (이력 기록용)</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="예: 정기 점검 안내, 장애 공지"
        className="h-9"
      />
    </div>
  );
}

// ── 메일 탭 ───────────────────────────────────────────────────────
function MailTab({ senderEmail }: { senderEmail: string }) {
  const confirm = useConfirmDialog();
  const [pending, startTransition] = useTransition();
  const [aiPending, startAi] = useTransition();
  const [recipients, setRecipients] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [reason, setReason] = useState('');

  function aiWrite() {
    if (subject.trim().length + body.trim().length < 3) {
      toast.error('제목 또는 본문을 입력해주세요');
      return;
    }
    startAi(async () => {
      const res = await aiWriteEmailAction({ subject, draft: body });
      if (!res.ok || !res.markdown) {
        toast.error(res.message ?? 'AI 작성 실패');
        return;
      }
      setBody(res.markdown);
      toast.success('AI가 본문을 작성했습니다. 확인 후 발송하세요.');
    });
  }

  async function send() {
    const list = parseRecipients(recipients);
    if (list.length === 0) return toast.error('수신자를 입력하세요');
    if (subject.trim().length === 0) return toast.error('제목을 입력하세요');
    if (body.trim().length === 0) return toast.error('본문을 입력하세요');

    const ok = await confirm({
      title: `메일 ${list.length}명에게 발송`,
      description: `발신: ${senderEmail}\n실제 운영 메일이 발송됩니다. 수신자와 본문을 확인하셨나요?`,
      confirmText: '발송',
      tone: 'danger',
    });
    if (!ok) return;

    startTransition(async () => {
      const res = await sendBulkEmailAction({
        recipients: list,
        subject: subject.trim(),
        markdown: body.trim(),
        reason: reason.trim() || undefined,
      });
      if (!res.ok) {
        toast.error(res.message ?? '발송 실패');
        return;
      }
      toast.success(`발송 완료 — 성공 ${res.sent} / 실패 ${res.failed}`);
    });
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5">
        <div className="flex items-center gap-2 text-sm">
          <Badge tone="brand">발신</Badge>
          <span className="font-mono text-slate-700 dark:text-slate-200">
            {senderEmail}
          </span>
        </div>

        <RecipientPicker mode="email" value={recipients} onChange={setRecipients} />

        <div className="flex flex-col gap-1">
          <Label className="text-xs">제목</Label>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={200}
            placeholder="메일 제목"
            className="h-9"
          />
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <Label className="text-xs">본문</Label>
            <button
              type="button"
              onClick={aiWrite}
              disabled={aiPending}
              className="inline-flex items-center gap-1 rounded-md border border-brand-200 bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700 transition hover:bg-brand-100 disabled:opacity-60 dark:border-brand-800 dark:bg-brand-950/40 dark:text-brand-300"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {aiPending ? '작성 중…' : 'AI 작성'}
            </button>
          </div>
          <RichEditor
            mode="full"
            value={body}
            onChange={setBody}
            minHeight={220}
            placeholder="메일 본문을 작성하거나 'AI 작성'으로 다듬으세요."
            disabled={pending}
          />
        </div>

        <ReasonInput value={reason} onChange={setReason} />

        <WarningBox>
          실제 운영 메일이 즉시 발송됩니다(취소 불가). 수신자·제목·본문을 반드시
          확인하세요. 대량 발송은 스팸 분류·평판 영향을 줄 수 있습니다.
        </WarningBox>

        <div className="flex justify-end">
          <Button type="button" onClick={send} disabled={pending}>
            <Mail className="h-4 w-4" />
            {pending ? '발송 중…' : '메일 발송'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── 문자 탭 ───────────────────────────────────────────────────────
function SmsTab({ senderPhone }: { senderPhone: string }) {
  const confirm = useConfirmDialog();
  const [pending, startTransition] = useTransition();
  const [recipients, setRecipients] = useState('');
  const [text, setText] = useState('');
  const [reason, setReason] = useState('');

  const bytes = useMemo(() => byteLength(text), [text]);
  const isLms = bytes > 90;
  const recipientCount = parseRecipients(recipients).length;
  // 대략 단가 (SMS 9원 / LMS 30원) — 표시용 추정.
  const unitCost = isLms ? 30 : 9;
  const estCost = unitCost * recipientCount;

  async function send() {
    const list = parseRecipients(recipients);
    if (list.length === 0) return toast.error('수신자를 입력하세요');
    if (text.trim().length === 0) return toast.error('본문을 입력하세요');

    const ok = await confirm({
      title: `문자 ${list.length}명에게 발송`,
      description: `발신: ${senderPhone}\n유형: ${isLms ? 'LMS' : 'SMS'} · 예상비용 약 ${estCost.toLocaleString()}원\n실제 운영 문자가 발송됩니다.`,
      confirmText: '발송',
      tone: 'danger',
    });
    if (!ok) return;

    startTransition(async () => {
      const res = await sendBulkSmsAction({
        recipients: list,
        text: text.trim(),
        reason: reason.trim() || undefined,
      });
      if (!res.ok) {
        toast.error(res.message ?? '발송 실패');
        return;
      }
      toast.success(`발송 완료 — 성공 ${res.sent} / 실패 ${res.failed}`);
    });
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5">
        <div className="flex items-center gap-2 text-sm">
          <Badge tone="brand">발신번호</Badge>
          <span className="font-mono text-slate-700 dark:text-slate-200">
            {senderPhone}
          </span>
        </div>

        <RecipientPicker mode="phone" value={recipients} onChange={setRecipients} />

        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <Label className="text-xs">본문</Label>
            <span className="text-xs text-slate-500">
              <Badge tone={isLms ? 'warn' : 'slate'} className="mr-1">
                {isLms ? 'LMS' : 'SMS'}
              </Badge>
              {bytes} byte
            </span>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            maxLength={2000}
            placeholder="문자 본문 (90 byte 이하 SMS, 초과 시 LMS)"
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900"
          />
          <div className="flex justify-between text-[11px] text-slate-400">
            <span>한글 2byte · 영문/숫자 1byte 기준</span>
            <span>
              {recipientCount}명 · 예상비용 약 {estCost.toLocaleString()}원
            </span>
          </div>
        </div>

        <ReasonInput value={reason} onChange={setReason} />

        <WarningBox>
          실제 운영 문자가 즉시 발송됩니다(취소 불가). 발송 비용이 발생하며,
          광고성 문자는 (광고) 표기·수신거부 안내 등 법적 요건을 준수해야 합니다.
        </WarningBox>

        <div className="flex justify-end">
          <Button type="button" onClick={send} disabled={pending}>
            <MessageSquare className="h-4 w-4" />
            {pending ? '발송 중…' : '문자 발송'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── 지난 이력 탭 ───────────────────────────────────────────────────
type HistoryFilter = 'all' | 'email' | 'sms';
const PAGE_SIZE = 30;

/** 클립보드 복사 (fallback 포함). */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fallthrough */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 항목 전체 텍스트 (타입·연락처·제목·본문·사유·일시). */
function buildFullText(item: MessagingHistoryItem): string {
  const lines = [
    `[타입] ${item.channel === 'email' ? '메일' : '문자'}`,
    `[${item.channel === 'email' ? '메일주소' : '연락처'}] ${item.toAddress}`,
  ];
  if (item.channel === 'email' && item.subject) lines.push(`[제목] ${item.subject}`);
  if (item.reason) lines.push(`[사유] ${item.reason}`);
  lines.push(`[일시] ${formatDateTime(item.createdAt)}`);
  lines.push('', item.body || '(본문 없음)');
  return lines.join('\n');
}

function CopyButton({
  label,
  text,
  disabled,
}: {
  label: string;
  text: string;
  disabled?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  async function onClick() {
    const ok = await copyText(text);
    if (!ok) {
      toast.error('복사에 실패했습니다');
      return;
    }
    setCopied(true);
    toast.success(`${label} 복사됨`);
    window.setTimeout(() => setCopied(false), 1500);
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-brand-950/30 dark:hover:text-brand-300"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Clipboard className="h-3.5 w-3.5" />}
      {label}
    </button>
  );
}

function HistoryCard({ item }: { item: MessagingHistoryItem }) {
  const isEmail = item.channel === 'email';
  return (
    <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Badge tone={isEmail ? 'brand' : 'slate'}>
          {isEmail ? (
            <Mail className="h-3 w-3" />
          ) : (
            <MessageSquare className="h-3 w-3" />
          )}
          {isEmail ? '메일' : '문자'}
        </Badge>
        <Badge tone={item.status === 'sent' ? 'success' : 'danger'}>
          {item.status === 'sent' ? '성공' : '실패'}
        </Badge>
        <span className="font-mono text-xs text-slate-700 dark:text-slate-200">
          {item.toAddress || '(주소 없음)'}
        </span>
        <span className="ml-auto text-[11px] text-slate-400">
          {formatDateTime(item.createdAt)}
        </span>
      </div>

      {isEmail && item.subject && (
        <p className="mb-1 text-sm font-medium text-slate-800 dark:text-slate-100">
          {item.subject}
        </p>
      )}
      {item.reason && (
        <p className="mb-1 text-xs text-slate-500">사유: {item.reason}</p>
      )}

      <p className="whitespace-pre-wrap break-words text-sm text-slate-600 dark:text-slate-300">
        {item.body || (
          <span className="italic text-slate-400">
            본문이 기록되지 않은 이전 발송입니다.
          </span>
        )}
      </p>
      {item.errorMessage && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">
          오류: {item.errorMessage}
        </p>
      )}

      <div className="mt-2 flex flex-wrap gap-1.5">
        <CopyButton label="전체 복사" text={buildFullText(item)} />
        <CopyButton label="본문 복사" text={item.body} disabled={!item.body} />
        <CopyButton
          label={isEmail ? '메일주소 복사' : '연락처 복사'}
          text={item.toAddress}
          disabled={!item.toAddress}
        />
      </div>
    </div>
  );
}

function FilterTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'rounded-full px-3 py-1 text-xs font-medium transition-colors ' +
        (active
          ? 'bg-brand-600 text-white'
          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700')
      }
    >
      {children}
    </button>
  );
}

function HistoryTab() {
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const [items, setItems] = useState<MessagingHistoryItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, startLoading] = useTransition();

  const load = useCallback(
    (f: HistoryFilter, p: number) => {
      startLoading(async () => {
        const res = await listMessagingHistoryAction({
          channel: f,
          page: p,
          pageSize: PAGE_SIZE,
        });
        if (!res.ok) {
          toast.error(res.message ?? '이력 조회 실패');
          return;
        }
        const next = res.items ?? [];
        setItems((prev) => (p === 1 ? next : [...prev, ...next]));
        setHasMore(Boolean(res.hasMore));
        setPage(p);
      });
    },
    [],
  );

  useEffect(() => {
    load(filter, 1);
  }, [filter, load]);

  function changeFilter(f: HistoryFilter) {
    if (f === filter) return;
    setItems([]);
    setHasMore(false);
    setFilter(f);
  }

  const empty = !loading && items.length === 0;

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-1.5">
            <FilterTab active={filter === 'all'} onClick={() => changeFilter('all')}>
              전체
            </FilterTab>
            <FilterTab active={filter === 'email'} onClick={() => changeFilter('email')}>
              메일
            </FilterTab>
            <FilterTab active={filter === 'sms'} onClick={() => changeFilter('sms')}>
              문자
            </FilterTab>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => load(filter, 1)}
            disabled={loading}
          >
            <RefreshCw className={'h-4 w-4 ' + (loading ? 'animate-spin' : '')} />
            새로고침
          </Button>
        </div>

        {empty ? (
          <EmptyState
            icon={<History className="h-8 w-8" />}
            title="발송 이력이 없습니다"
            description="메일·문자를 발송하면 이곳에 기록됩니다."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {items.map((item) => (
              <HistoryCard key={item.id} item={item} />
            ))}
            {loading && items.length === 0 && (
              <p className="py-6 text-center text-sm text-slate-400">불러오는 중…</p>
            )}
            {hasMore && (
              <div className="flex justify-center pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => load(filter, page + 1)}
                  disabled={loading}
                >
                  {loading ? '불러오는 중…' : '더 보기'}
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
