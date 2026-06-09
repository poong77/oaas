'use client';

/**
 * 메일&문자 발송 클라이언트 (P7 + 메시지함 개편).
 *
 * 탭: 메일(SES) / 문자(Solapi) / 메시지함(발송 묶음 테이블).
 * - 공용 수신자 선택(호텔 검색 → 연락처 추가 + 직접 입력), 수신자별 변수 매핑 보관.
 * - 메일: 발신자 앞부분 입력(@oapms.com 고정)·제목·본문(RichEditor)·변수 칩·푸터 미리보기·AI 작성.
 * - 문자: 제목(선택)·본문·변수 칩·글자수(SMS/LMS).
 * - 메시지함: 발송 묶음 1행(총발송/성공/실패), 검색(발송일·유형·업체명·메일주소·문자번호), 20/50/100.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react';
import { toast } from 'sonner';
import {
  AlertTriangle,
  Check,
  Clipboard,
  Inbox,
  Mail,
  MessageSquare,
  Search,
  Sparkles,
  X,
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
  listMessageBatchesAction,
  getBatchRecipientsAction,
  sendBulkEmailAction,
  sendBulkSmsAction,
  type MessageBatchItem,
  type BatchRecipient,
  type SendRecipient,
} from '@/app/actions/messaging-actions';
import {
  MESSAGE_VARIABLES,
  MAIL_FOOTER,
  byteLength,
  classifySms,
  smsKindLabel,
  type MessageVars,
} from '@/lib/messaging/format';

type Tab = 'mail' | 'sms' | 'messagebox';
type HotelHit = { id: string; name: string };

/** 수신자 주소 → 변수/업체명 매핑 (호텔 검색으로 추가된 수신자). */
type RecipientMeta = {
  hotels: string[]; // 추가된 호텔명 (복수 가능)
  person?: string | null;
  phone?: string | null;
};
type MetaMap = Record<string, RecipientMeta>;

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

/** 주소+메타 → 구조화 수신자(업체명 표시 + 치환 변수). */
function buildSendRecipients(addresses: string[], meta: MetaMap): SendRecipient[] {
  return addresses.map((address) => {
    const m = meta[address];
    if (!m || m.hotels.length === 0) {
      return { address, company: null };
    }
    const first = m.hotels[0]!;
    const extra = m.hotels.length - 1;
    const company = extra > 0 ? `${first}(+${extra})` : first;
    const vars: MessageVars = {
      업체명: first,
      호텔명: first,
      담당자명: m.person ?? '',
      연락처: m.phone ?? '',
    };
    return { address, company, vars };
  });
}

export function MessagingClient({
  senderEmailLocal,
  senderPhone,
}: {
  senderEmailLocal: string;
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
        <TabButton active={tab === 'messagebox'} onClick={() => setTab('messagebox')} icon={<Inbox className="h-4 w-4" />}>
          메시지함
        </TabButton>
      </div>

      {tab === 'mail' ? (
        <MailTab senderEmailLocal={senderEmailLocal} />
      ) : tab === 'sms' ? (
        <SmsTab senderPhone={senderPhone} />
      ) : (
        <MessageBoxTab />
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
  onMeta,
}: {
  mode: 'email' | 'phone';
  value: string;
  onChange: (v: string) => void;
  /** 호텔에서 추가한 수신자의 변수/업체명 매핑 보고. */
  onMeta: (address: string, meta: { hotel: string; person?: string | null; phone?: string | null }) => void;
}) {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<HotelHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [contacts, setContacts] = useState<string[] | null>(null);
  const [people, setPeople] = useState<Array<{ name: string; email: string | null; phone: string | null }>>([]);
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
      setPeople([]);
      return;
    }
    setPeople(res.people ?? []);
    setContacts(mode === 'email' ? (res.emails ?? []) : (res.phones ?? []));
  }

  /** 연락처 → 담당자/연락처 메타 추론 후 보고. */
  function reportMeta(c: string) {
    if (!pickedHotel) return;
    const person =
      mode === 'email'
        ? people.find((p) => p.email === c)
        : people.find((p) => (p.phone ?? '').replace(/[^0-9]/g, '') === c.replace(/[^0-9]/g, ''));
    onMeta(c, {
      hotel: pickedHotel,
      person: person?.name ?? null,
      phone: mode === 'phone' ? c : (person?.phone ?? null),
    });
  }

  function addOne(c: string) {
    const cur = parseRecipients(value);
    reportMeta(c);
    if (cur.includes(c)) return;
    onChange([...cur, c].join('\n'));
  }
  function addAll() {
    if (!contacts) return;
    contacts.forEach(reportMeta);
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

/** 본문 라벨 옆 변수 칩 — 클릭 시 onInsert(token). */
function VariableChips({ onInsert }: { onInsert: (token: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[11px] text-slate-400">변수 삽입</span>
      {MESSAGE_VARIABLES.map((v) => (
        <button
          key={v.token}
          type="button"
          onClick={() => onInsert(v.token)}
          title={`${v.token} 삽입`}
          className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 transition hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
        >
          + {v.label}
        </button>
      ))}
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

/** 메일 본문 하단 회사 푸터 미리보기 (발송 시 자동 첨부). */
function MailFooterPreview() {
  return (
    <div className="mt-3 border-t border-slate-200 pt-3 text-[11.5px] leading-relaxed text-slate-500 dark:border-slate-700">
      <div className="font-semibold text-slate-700 dark:text-slate-200">
        {MAIL_FOOTER.companyKo} &nbsp;|&nbsp; <span className="text-slate-400">{MAIL_FOOTER.companyEn}</span>
      </div>
      <div>{MAIL_FOOTER.hq}</div>
      <div>{MAIL_FOOTER.seoul}</div>
      <div className="mt-0.5">
        {MAIL_FOOTER.tel} &nbsp;|&nbsp; {MAIL_FOOTER.fax}
      </div>
    </div>
  );
}

// ── 메일 탭 ───────────────────────────────────────────────────────
function MailTab({ senderEmailLocal }: { senderEmailLocal: string }) {
  const confirm = useConfirmDialog();
  const [pending, startTransition] = useTransition();
  const [aiPending, startAi] = useTransition();
  const [fromLocal, setFromLocal] = useState(senderEmailLocal);
  const [recipients, setRecipients] = useState('');
  const [meta, setMeta] = useState<MetaMap>({});
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [reason, setReason] = useState('');

  const addMeta = useCallback(
    (address: string, m: { hotel: string; person?: string | null; phone?: string | null }) => {
      setMeta((prev) => {
        const cur = prev[address] ?? { hotels: [] };
        const hotels = cur.hotels.includes(m.hotel) ? cur.hotels : [...cur.hotels, m.hotel];
        return {
          ...prev,
          [address]: { hotels, person: m.person ?? cur.person, phone: m.phone ?? cur.phone },
        };
      });
    },
    [],
  );

  function insertVar(token: string) {
    setBody((b) => (b.length === 0 || b.endsWith('\n') || b.endsWith(' ') ? b + token : b + ' ' + token));
  }

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

  const fromEmail = `${(fromLocal.trim() || 'as')}@oapms.com`;

  async function send() {
    const list = parseRecipients(recipients);
    if (list.length === 0) return toast.error('수신자를 입력하세요');
    if (subject.trim().length === 0) return toast.error('제목을 입력하세요');
    if (body.trim().length === 0) return toast.error('본문을 입력하세요');

    const ok = await confirm({
      title: `메일 ${list.length}명에게 발송`,
      description: `발신: ${fromEmail}\n실제 운영 메일이 발송됩니다. 수신자와 본문을 확인하셨나요?`,
      confirmText: '발송',
      tone: 'danger',
    });
    if (!ok) return;

    startTransition(async () => {
      const res = await sendBulkEmailAction({
        recipients: buildSendRecipients(list, meta),
        fromLocal: fromLocal.trim() || undefined,
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
        <div className="flex flex-col gap-1">
          <Label className="text-xs">발신자 주소</Label>
          <div className="flex items-stretch">
            <Input
              value={fromLocal}
              onChange={(e) => setFromLocal(e.target.value.replace(/[^a-zA-Z0-9._-]/g, ''))}
              placeholder="as"
              className="h-9 max-w-[180px] rounded-r-none font-mono"
            />
            <span className="inline-flex items-center rounded-r-md border border-l-0 border-slate-200 bg-slate-100 px-3 font-mono text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800">
              @oapms.com
            </span>
          </div>
          <span className="text-[11px] text-slate-400">
            앞부분만 입력하세요. 도메인은 @oapms.com 고정 · SES 프로덕션 검증 완료
          </span>
        </div>

        <RecipientPicker mode="email" value={recipients} onChange={setRecipients} onMeta={addMeta} />

        <div className="flex flex-col gap-1">
          <Label className="text-xs">제목</Label>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={200}
            placeholder="메일 제목 (변수 사용 가능: #{업체명} 등)"
            className="h-9"
          />
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <Label className="text-xs">본문</Label>
              <VariableChips onInsert={insertVar} />
            </div>
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
            placeholder="메일 본문을 작성하거나 'AI 작성'으로 다듬으세요. 변수는 발송 시 수신자별 값으로 치환됩니다."
            disabled={pending}
          />
          <MailFooterPreview />
        </div>

        <ReasonInput value={reason} onChange={setReason} />

        <WarningBox>
          실제 운영 메일이 즉시 발송됩니다(취소 불가). 본문 하단에 회사 푸터가 자동 첨부되며, 변수(#{'{'}업체명{'}'} 등)는
          수신자별 실제 값으로 치환됩니다. 수신자·제목·본문을 반드시 확인하세요.
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
  const [meta, setMeta] = useState<MetaMap>({});
  const [subject, setSubject] = useState('');
  const [text, setText] = useState('');
  const [reason, setReason] = useState('');
  const textRef = useRef<HTMLTextAreaElement>(null);

  const addMeta = useCallback(
    (address: string, m: { hotel: string; person?: string | null; phone?: string | null }) => {
      setMeta((prev) => {
        const cur = prev[address] ?? { hotels: [] };
        const hotels = cur.hotels.includes(m.hotel) ? cur.hotels : [...cur.hotels, m.hotel];
        return {
          ...prev,
          [address]: { hotels, person: m.person ?? cur.person, phone: m.phone ?? cur.phone },
        };
      });
    },
    [],
  );

  function insertVar(token: string) {
    const el = textRef.current;
    if (!el) {
      setText((t) => t + token);
      return;
    }
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;
    const next = text.slice(0, start) + token + text.slice(end);
    setText(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  }

  const bytes = useMemo(() => byteLength(text), [text]);
  const kind = classifySms({ text, hasSubject: subject.trim().length > 0 });
  const isLms = kind !== 'sms';
  const recipientCount = parseRecipients(recipients).length;
  const unitCost = isLms ? 30 : 9;
  const estCost = unitCost * recipientCount;

  async function send() {
    const list = parseRecipients(recipients);
    if (list.length === 0) return toast.error('수신자를 입력하세요');
    if (text.trim().length === 0) return toast.error('본문을 입력하세요');

    const ok = await confirm({
      title: `문자 ${list.length}명에게 발송`,
      description: `발신: ${senderPhone}\n유형: ${smsKindLabel(kind)} · 예상비용 약 ${estCost.toLocaleString()}원\n실제 운영 문자가 발송됩니다.`,
      confirmText: '발송',
      tone: 'danger',
    });
    if (!ok) return;

    startTransition(async () => {
      const res = await sendBulkSmsAction({
        recipients: buildSendRecipients(list, meta),
        subject: subject.trim() || undefined,
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
          <span className="font-mono text-slate-700 dark:text-slate-200">{senderPhone}</span>
        </div>

        <RecipientPicker mode="phone" value={recipients} onChange={setRecipients} onMeta={addMeta} />

        <div className="flex flex-col gap-1">
          <Label className="text-xs">
            제목 <span className="font-normal text-slate-400">(선택사항)</span>
          </Label>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={40}
            placeholder="제목 입력 시 LMS로 발송됩니다"
            className="h-9"
          />
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <Label className="text-xs">본문</Label>
              <VariableChips onInsert={insertVar} />
            </div>
            <span className="text-xs text-slate-500">
              <Badge tone={isLms ? 'warn' : 'slate'} className="mr-1">
                {smsKindLabel(kind)}
              </Badge>
              {bytes} byte
            </span>
          </div>
          <textarea
            ref={textRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            maxLength={2000}
            placeholder="문자 본문 (90 byte 이하 SMS, 제목 입력·90 byte 초과 시 LMS). 변수: #{업체명} 등"
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900"
          />
          <div className="flex justify-between text-[11px] text-slate-400">
            <span>한글 2byte · 영문/숫자 1byte 기준 · 변수는 수신자별 치환</span>
            <span>
              {recipientCount}명 · 예상비용 약 {estCost.toLocaleString()}원
            </span>
          </div>
        </div>

        <ReasonInput value={reason} onChange={setReason} />

        <WarningBox>
          실제 운영 문자가 즉시 발송됩니다(취소 불가). 발송 비용이 발생하며, 광고성 문자는 (광고) 표기·수신거부 안내 등
          법적 요건을 준수해야 합니다.
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

// ── 메시지함 탭 ───────────────────────────────────────────────────
type MsgTypeFilter = 'all' | 'email' | 'sms' | 'lms' | 'mms';
type PageSize = 20 | 50 | 100;

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

function formatDateTimeSec(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function typeBadge(item: MessageBatchItem) {
  if (item.channel === 'email') return <Badge tone="brand">메일</Badge>;
  const tone = item.msgType === 'lms' ? 'warn' : item.msgType === 'mms' ? 'success' : 'slate';
  return (
    <Badge tone={tone as 'warn' | 'success' | 'slate'}>
      문자 {item.msgType.toUpperCase()}
    </Badge>
  );
}

function CopyButton({ label, text, disabled }: { label: string; text: string; disabled?: boolean }) {
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

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-auto p-4">{children}</div>
      </div>
    </div>
  );
}

function RecipientsModal({ item, onClose }: { item: MessageBatchItem; onClose: () => void }) {
  const [recipients, setRecipients] = useState<BatchRecipient[] | null>(null);
  const [loading, startLoading] = useTransition();

  useEffect(() => {
    startLoading(async () => {
      const res = await getBatchRecipientsAction(item.batchId);
      if (!res.ok) {
        toast.error(res.message ?? '수신자 조회 실패');
        setRecipients([]);
        return;
      }
      setRecipients(res.recipients ?? []);
    });
  }, [item.batchId]);

  const isEmail = item.channel === 'email';
  const addrText = (recipients ?? []).map((r) => r.address).join('\n');

  return (
    <Modal title={`수신자 ${item.total}명 · ${formatDateTimeSec(item.createdAt)}`} onClose={onClose}>
      {loading || recipients === null ? (
        <p className="py-6 text-center text-sm text-slate-400">불러오는 중…</p>
      ) : recipients.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">수신자가 없습니다.</p>
      ) : (
        <div className="flex flex-col gap-1">
          {recipients.map((r, i) => (
            <div
              key={`${r.address}-${i}`}
              className="flex items-center justify-between gap-3 border-b border-slate-100 py-1.5 text-sm dark:border-slate-800"
            >
              <span className="font-medium text-slate-700 dark:text-slate-200">
                {r.company ?? <span className="text-slate-400">직접입력</span>}
              </span>
              <span className="flex-1 truncate text-right font-mono text-xs text-slate-500">{r.address}</span>
              <span className={'shrink-0 text-xs ' + (r.status === 'sent' ? 'text-green-600' : 'text-red-600')}>
                {r.status === 'sent' ? '성공' : '실패'}
              </span>
            </div>
          ))}
          <div className="mt-3 flex justify-end">
            <CopyButton label={isEmail ? '메일주소 전체 복사' : '연락처 전체 복사'} text={addrText} />
          </div>
        </div>
      )}
    </Modal>
  );
}

function BodyModal({ item, onClose }: { item: MessageBatchItem; onClose: () => void }) {
  return (
    <Modal title={item.subject || (item.channel === 'email' ? '(제목 없음)' : '문자 본문')} onClose={onClose}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {typeBadge(item)}
        {item.reason && <span className="text-xs text-slate-500">사유: {item.reason}</span>}
      </div>
      <div className="whitespace-pre-wrap break-words rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
        {item.body || <span className="italic text-slate-400">본문이 없습니다.</span>}
      </div>
      {item.body && /#\{(업체명|담당자명|연락처|호텔명)\}/.test(item.body) && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-slate-500">파라미터</span>
          {MESSAGE_VARIABLES.filter((v) => item.body.includes(v.token)).map((v) => (
            <span
              key={v.token}
              className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-mono text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
            >
              {v.token}
            </span>
          ))}
        </div>
      )}
      <div className="mt-3 flex justify-end">
        <CopyButton label="본문 복사" text={item.body} disabled={!item.body} />
      </div>
    </Modal>
  );
}

const TYPE_OPTIONS: Array<{ value: MsgTypeFilter; label: string }> = [
  { value: 'all', label: '전체' },
  { value: 'email', label: '메일' },
  { value: 'sms', label: '문자 SMS' },
  { value: 'lms', label: '문자 LMS' },
  { value: 'mms', label: '문자 MMS' },
];

function MessageBoxTab() {
  const [type, setType] = useState<MsgTypeFilter>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [pageSize, setPageSize] = useState<PageSize>(20);
  const [page, setPage] = useState(1);

  const [items, setItems] = useState<MessageBatchItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, startLoading] = useTransition();

  const [recipModal, setRecipModal] = useState<MessageBatchItem | null>(null);
  const [bodyModal, setBodyModal] = useState<MessageBatchItem | null>(null);

  // 적용된(검색 버튼 누른) 조건. 입력 중 값과 분리.
  const [applied, setApplied] = useState({
    type: 'all' as MsgTypeFilter,
    dateFrom: '',
    dateTo: '',
    company: '',
    email: '',
    phone: '',
  });

  const load = useCallback(
    (p: number, ps: PageSize, f: typeof applied) => {
      startLoading(async () => {
        const res = await listMessageBatchesAction({
          type: f.type,
          dateFrom: f.dateFrom || undefined,
          dateTo: f.dateTo || undefined,
          company: f.company || undefined,
          email: f.email || undefined,
          phone: f.phone || undefined,
          page: p,
          pageSize: ps,
        });
        if (!res.ok) {
          toast.error(res.message ?? '메시지함 조회 실패');
          return;
        }
        setItems(res.items ?? []);
        setTotal(res.total ?? 0);
        setPage(p);
      });
    },
    [],
  );

  useEffect(() => {
    load(1, pageSize, applied);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function runSearch() {
    const next = { type, dateFrom, dateTo, company: company.trim(), email: email.trim(), phone: phone.trim() };
    setApplied(next);
    load(1, pageSize, next);
  }

  function reset() {
    setType('all');
    setDateFrom('');
    setDateTo('');
    setCompany('');
    setEmail('');
    setPhone('');
    const next = { type: 'all' as MsgTypeFilter, dateFrom: '', dateTo: '', company: '', email: '', phone: '' };
    setApplied(next);
    load(1, pageSize, next);
  }

  function changePageSize(ps: PageSize) {
    setPageSize(ps);
    load(1, ps, applied);
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const empty = !loading && items.length === 0;

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5">
        {/* 검색 조건 */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-1 sm:col-span-2">
            <Label className="text-xs">발송일</Label>
            <div className="flex items-center gap-1.5">
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9" />
              <span className="text-slate-400">~</span>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9" />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">유형</Label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as MsgTypeFilter)}
              className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900"
            >
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">업체명</Label>
            <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="호텔명" className="h-9" />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">메일주소</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@…" className="h-9" />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">문자번호</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="010…" className="h-9" />
          </div>
          <div className="flex items-end justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="outline" size="sm" onClick={reset} disabled={loading}>
              초기화
            </Button>
            <Button type="button" size="sm" onClick={runSearch} disabled={loading}>
              <Search className="h-4 w-4" />
              검색
            </Button>
          </div>
        </div>

        {/* 툴바 */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <span>
            총 <b className="text-slate-700 dark:text-slate-200">{total.toLocaleString()}</b>건 발송 묶음
          </span>
          <div className="flex items-center gap-2">
            <span>페이지당</span>
            <div className="inline-flex overflow-hidden rounded-md border border-slate-200 dark:border-slate-700">
              {([20, 50, 100] as PageSize[]).map((ps) => (
                <button
                  key={ps}
                  type="button"
                  onClick={() => changePageSize(ps)}
                  className={
                    'px-2.5 py-1 text-xs ' +
                    (pageSize === ps
                      ? 'bg-brand-600 text-white'
                      : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800')
                  }
                >
                  {ps}
                </button>
              ))}
            </div>
          </div>
        </div>

        {empty ? (
          <EmptyState
            icon={<Inbox className="h-8 w-8" />}
            title="발송 묶음이 없습니다"
            description="메일·문자를 발송하면 이곳에 발송 단위로 기록됩니다."
          />
        ) : (
          <>
            {/* 데스크탑 테이블 */}
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs text-slate-500 dark:border-slate-700">
                    <th className="whitespace-nowrap px-2 py-2">발송일시</th>
                    <th className="px-2 py-2 text-center">유형</th>
                    <th className="px-2 py-2 text-center">총발송</th>
                    <th className="px-2 py-2 text-right">성공</th>
                    <th className="px-2 py-2 text-right">실패</th>
                    <th className="px-2 py-2 text-center">본문</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr
                      key={item.batchId}
                      className="border-b border-slate-100 dark:border-slate-800"
                    >
                      <td className="whitespace-nowrap px-2 py-2.5 font-mono text-xs text-slate-700 dark:text-slate-200">
                        {formatDateTimeSec(item.createdAt)}
                      </td>
                      <td className="px-2 py-2.5 text-center">{typeBadge(item)}</td>
                      <td className="px-2 py-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => setRecipModal(item)}
                          className="font-medium text-brand-600 underline decoration-dotted hover:text-brand-700 dark:text-brand-400"
                        >
                          {item.total}명
                        </button>
                      </td>
                      <td className="px-2 py-2.5 text-right font-semibold text-green-600">{item.success}</td>
                      <td className={'px-2 py-2.5 text-right font-semibold ' + (item.failed > 0 ? 'text-red-600' : 'text-slate-400')}>
                        {item.failed}
                      </td>
                      <td className="px-2 py-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => setBodyModal(item)}
                          className="font-medium text-brand-600 underline decoration-dotted hover:text-brand-700 dark:text-brand-400"
                        >
                          보기
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 모바일 카드 */}
            <div className="flex flex-col gap-2 sm:hidden">
              {items.map((item) => (
                <div key={item.batchId} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    {typeBadge(item)}
                    <span className="font-mono text-[11px] text-slate-400">{formatDateTimeSec(item.createdAt)}</span>
                  </div>
                  {item.subject && (
                    <p className="mb-1 truncate text-sm font-medium text-slate-800 dark:text-slate-100">{item.subject}</p>
                  )}
                  <div className="flex items-center gap-3 text-xs">
                    <button type="button" onClick={() => setRecipModal(item)} className="text-brand-600 underline decoration-dotted">
                      총 {item.total}명
                    </button>
                    <span className="text-green-600">성공 {item.success}</span>
                    <span className={item.failed > 0 ? 'text-red-600' : 'text-slate-400'}>실패 {item.failed}</span>
                    <button type="button" onClick={() => setBodyModal(item)} className="ml-auto text-brand-600 underline decoration-dotted">
                      본문
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* 페이지네이션 */}
            <div className="flex items-center justify-center gap-2 pt-1 text-sm">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => load(page - 1, pageSize, applied)}
                disabled={loading || page <= 1}
              >
                이전
              </Button>
              <span className="text-xs text-slate-500">
                {page} / {totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => load(page + 1, pageSize, applied)}
                disabled={loading || page >= totalPages}
              >
                다음
              </Button>
            </div>
          </>
        )}

        {loading && items.length === 0 && (
          <p className="py-6 text-center text-sm text-slate-400">불러오는 중…</p>
        )}
      </CardContent>

      {recipModal && <RecipientsModal item={recipModal} onClose={() => setRecipModal(null)} />}
      {bodyModal && <BodyModal item={bodyModal} onClose={() => setBodyModal(null)} />}
    </Card>
  );
}
