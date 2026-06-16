'use client';

/**
 * 메시지함 탭 — 발송 묶음 조회.
 * MSG-23: 컬럼 개편 (발송일시·유형·제목·수신·결과·발송자).
 */

import { useCallback, useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Inbox, Search } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EmptyState } from '@/components/ui/empty-state';
import {
  listMessageBatchesAction,
  getBatchRecipientsAction,
  type MessageBatchItem,
  type BatchRecipient,
} from '@/app/actions/messaging-actions';
import {
  Modal,
  CopyButton,
  typeBadge,
  formatDateTimeSec,
  recipientSummary,
} from './shared';

type MsgTypeFilter = 'all' | 'email' | 'sms' | 'lms' | 'mms';
type PageSize = 20 | 50 | 100;

const TYPE_OPTIONS: Array<{ value: MsgTypeFilter; label: string }> = [
  { value: 'all', label: '전체' },
  { value: 'email', label: '메일' },
  { value: 'sms', label: '문자 SMS' },
  { value: 'lms', label: '문자 LMS' },
  { value: 'mms', label: '문자 MMS' },
];

function ResultCell({ item }: { item: MessageBatchItem }) {
  return (
    <span className="text-xs">
      <span className="font-semibold text-green-600">성공 {item.success}</span>
      <span className="mx-1 text-slate-300">/</span>
      <span className={item.failed > 0 ? 'font-bold text-red-600' : 'text-slate-400'}>실패 {item.failed}</span>
    </span>
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
        {item.senderName && <span className="text-xs text-slate-500">발송자: {item.senderName}</span>}
        {item.reason && <span className="text-xs text-slate-500">사유: {item.reason}</span>}
      </div>
      <div className="whitespace-pre-wrap break-words rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
        {item.body || <span className="italic text-slate-400">본문이 없습니다.</span>}
      </div>
      {item.body && /#\{[^}]+\}/.test(item.body) && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-slate-500">파라미터</span>
          {[...new Set(Array.from(item.body.matchAll(/#\{([^}]+)\}/g)).map((m) => m[1]))].map((name) => (
            <span
              key={name}
              className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-mono text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
            >
              #{`{${name}}`}
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

export function MessageBoxTab() {
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

  const [applied, setApplied] = useState({
    type: 'all' as MsgTypeFilter,
    dateFrom: '',
    dateTo: '',
    company: '',
    email: '',
    phone: '',
  });

  const load = useCallback((p: number, ps: PageSize, f: typeof applied) => {
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
  }, []);

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
                    (pageSize === ps ? 'bg-brand-600 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800')
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
            {/* 데스크탑 테이블 — MSG-23 컬럼 */}
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs text-slate-500 dark:border-slate-700">
                    <th className="whitespace-nowrap px-2 py-2">발송일시</th>
                    <th className="px-2 py-2 text-center">유형</th>
                    <th className="px-2 py-2">제목</th>
                    <th className="px-2 py-2">수신</th>
                    <th className="px-2 py-2">결과</th>
                    <th className="px-2 py-2">발송자</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.batchId} className="border-b border-slate-100 dark:border-slate-800">
                      <td className="whitespace-nowrap px-2 py-2.5 font-mono text-xs text-slate-700 dark:text-slate-200">
                        {formatDateTimeSec(item.createdAt)}
                      </td>
                      <td className="px-2 py-2.5 text-center">{typeBadge(item)}</td>
                      <td className="max-w-[260px] px-2 py-2.5">
                        <button
                          type="button"
                          onClick={() => setBodyModal(item)}
                          className="block truncate text-left font-medium text-brand-600 hover:text-brand-700 hover:underline dark:text-brand-400"
                        >
                          {item.subject || (item.channel === 'email' ? '(제목 없음)' : '문자 본문')}
                        </button>
                      </td>
                      <td className="px-2 py-2.5 text-xs">
                        <button
                          type="button"
                          onClick={() => setRecipModal(item)}
                          className="text-brand-600 underline decoration-dotted hover:text-brand-700 dark:text-brand-400"
                        >
                          {recipientSummary(item)}
                        </button>
                      </td>
                      <td className="px-2 py-2.5">
                        <ResultCell item={item} />
                      </td>
                      <td className="px-2 py-2.5 text-xs text-slate-600 dark:text-slate-300">
                        {item.senderName ?? <span className="text-slate-400">—</span>}
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
                  <button
                    type="button"
                    onClick={() => setBodyModal(item)}
                    className="mb-1 block w-full truncate text-left text-sm font-medium text-slate-800 hover:underline dark:text-slate-100"
                  >
                    {item.subject || (item.channel === 'email' ? '(제목 없음)' : '문자 본문')}
                  </button>
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <button type="button" onClick={() => setRecipModal(item)} className="text-brand-600 underline decoration-dotted">
                      {recipientSummary(item)}
                    </button>
                    <ResultCell item={item} />
                    {item.senderName && <span className="ml-auto text-slate-400">{item.senderName}</span>}
                  </div>
                </div>
              ))}
            </div>

            {/* 페이지네이션 */}
            <div className="flex items-center justify-center gap-2 pt-1 text-sm">
              <Button type="button" variant="outline" size="sm" onClick={() => load(page - 1, pageSize, applied)} disabled={loading || page <= 1}>
                이전
              </Button>
              <span className="text-xs text-slate-500">
                {page} / {totalPages}
              </span>
              <Button type="button" variant="outline" size="sm" onClick={() => load(page + 1, pageSize, applied)} disabled={loading || page >= totalPages}>
                다음
              </Button>
            </div>
          </>
        )}

        {loading && items.length === 0 && <p className="py-6 text-center text-sm text-slate-400">불러오는 중…</p>}
      </CardContent>

      {recipModal && <RecipientsModal item={recipModal} onClose={() => setRecipModal(null)} />}
      {bodyModal && <BodyModal item={bodyModal} onClose={() => setBodyModal(null)} />}
    </Card>
  );
}
