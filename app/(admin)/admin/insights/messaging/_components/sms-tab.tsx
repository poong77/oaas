'use client';

/**
 * 문자 탭 (Solapi).
 * - MSG-19: 제목 필수 + 기본값 [오아테크]
 * - MSG-21: 본문 좌우 분할 — 좌 입력 / 우 실시간 휴대폰 말풍선 미리보기
 * - MSG-15: 변수 값 패널
 * - MSG-22: 테스트 발송
 */

import { useCallback, useMemo, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { MessageSquare, FlaskConical } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useConfirmDialog } from '@/components/dialogs/confirm-dialog';
import {
  byteLength,
  classifySms,
  smsKindLabel,
  extractVarNames,
  resolveRecipientVars,
  substituteAll,
} from '@/lib/messaging/format';
import { sendBulkSmsAction, sendTestSmsAction } from '@/app/actions/messaging-actions';
import type { VarSource } from '@/lib/messaging/format';
import {
  buildSendRecipients,
  parseRecipients,
  ReasonInput,
  VariableChips,
  WarningBox,
  Modal,
  type MetaMap,
  type TemplateSeed,
} from './shared';
import { RecipientPicker, type PickerMeta } from './recipient-picker';
import { VariablePanel, effectiveBindings } from './variable-panel';

const DEFAULT_SMS_SUBJECT = '[오아테크]';

export function SmsTab({ senderPhone, seed }: { senderPhone: string; seed?: TemplateSeed | null }) {
  const confirm = useConfirmDialog();
  const [pending, startTransition] = useTransition();
  const [testPending, startTest] = useTransition();

  const [recipients, setRecipients] = useState('');
  const [meta, setMeta] = useState<MetaMap>({});
  const [subject, setSubject] = useState(seed?.subject || DEFAULT_SMS_SUBJECT);
  const [text, setText] = useState(seed?.body ?? '');
  const [reason, setReason] = useState('');
  const [varOverrides, setVarOverrides] = useState<Record<string, { source: VarSource; value: string }>>(
    () => Object.fromEntries((seed?.variables ?? []).map((v) => [v.name, { source: v.source, value: '' }])),
  );
  const [customVarNames, setCustomVarNames] = useState<string[]>(() => (seed?.variables ?? []).map((v) => v.name));
  const [excelAvailable, setExcelAvailable] = useState(false);
  const [previewIdx, setPreviewIdx] = useState(0);
  const [testOpen, setTestOpen] = useState(false);
  const [testTo, setTestTo] = useState('');
  const textRef = useRef<HTMLTextAreaElement>(null);

  const addMeta = useCallback((address: string, m: PickerMeta) => {
    if (m.excel && Object.keys(m.excel).length > 0) setExcelAvailable(true);
    setMeta((prev) => {
      const cur = prev[address] ?? { hotels: [] };
      const hotels = m.hotel && !cur.hotels.includes(m.hotel) ? [...cur.hotels, m.hotel] : cur.hotels;
      return {
        ...prev,
        [address]: {
          hotels,
          person: m.person ?? cur.person,
          phone: m.phone ?? cur.phone,
          excel: m.excel ? { ...(cur.excel ?? {}), ...m.excel } : cur.excel,
        },
      };
    });
  }, []);

  const registerVarNames = useCallback((names: string[]) => {
    setCustomVarNames((prev) => [...new Set([...prev, ...names])]);
  }, []);

  function insertVar(token: string) {
    const el = textRef.current;
    if (!el) {
      setText((t) => t + token);
      return;
    }
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;
    setText(text.slice(0, start) + token + text.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  }

  function editBinding(name: string, patch: Partial<{ source: VarSource; value: string }>) {
    setVarOverrides((prev) => {
      const cur = prev[name] ?? { source: 'auto' as VarSource, value: '' };
      return { ...prev, [name]: { ...cur, ...patch } };
    });
  }

  const usedNames = useMemo(() => extractVarNames(subject, text), [subject, text]);
  const bindings = useMemo(() => effectiveBindings(usedNames, varOverrides), [usedNames, varOverrides]);

  const list = useMemo(() => parseRecipients(recipients), [recipients]);
  const recipientCount = list.length;

  const sampleValues = useMemo(() => {
    const addr = list[Math.min(previewIdx, Math.max(0, list.length - 1))];
    const sample = addr ? buildSendRecipients([addr], meta)[0] : undefined;
    return resolveRecipientVars(
      bindings.map((b) => ({ name: b.name, source: b.source, value: b.value })),
      { auto: sample?.auto, excel: sample?.excel },
    );
  }, [list, previewIdx, meta, bindings]);

  const previewSubject = substituteAll(subject, sampleValues);
  const previewText = substituteAll(text, sampleValues);
  const bytes = byteLength(text);
  const kind = classifySms({ text, hasSubject: true });
  const isLms = kind !== 'sms';
  const unitCost = isLms ? 30 : 9;
  const estCost = unitCost * recipientCount;

  function runTest() {
    if (!testTo.trim()) return toast.error('테스트 받을 번호를 입력하세요');
    if (subject.trim().length === 0) return toast.error('제목을 입력하세요');
    if (text.trim().length === 0) return toast.error('본문을 입력하세요');
    startTest(async () => {
      const res = await sendTestSmsAction({
        to: testTo.trim(),
        subject: subject.trim(),
        text: text.trim(),
        sampleValues,
      });
      if (!res.ok) {
        toast.error(res.message ?? '테스트 발송 실패');
        return;
      }
      toast.success(`테스트 문자를 ${testTo.trim()}로 발송했습니다`);
      setTestOpen(false);
    });
  }

  async function send() {
    if (list.length === 0) return toast.error('수신자를 입력하세요');
    if (subject.trim().length === 0) return toast.error('제목을 입력하세요');
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
        subject: subject.trim(),
        text: text.trim(),
        reason: reason.trim() || undefined,
        varBindings: bindings.map((b) => ({ name: b.name, source: b.source, value: b.value })),
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

        <RecipientPicker
          mode="phone"
          value={recipients}
          onChange={setRecipients}
          onMeta={addMeta}
          onVarNames={registerVarNames}
        />

        {/* MSG-19 — 제목 필수 + 기본값 */}
        <div className="flex flex-col gap-1">
          <Label className="text-xs">제목 <span className="text-red-500">*</span></Label>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={40}
            placeholder="[오아테크]"
            className="h-9"
          />
          <span className="text-[11px] text-slate-400">제목이 있으면 LMS로 발송됩니다. 기본값 [오아테크]</span>
        </div>

        {/* MSG-21 — 좌우 분할: 좌 입력 / 우 미리보기 */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* 좌: 입력 */}
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label className="text-xs">본문</Label>
              <VariableChips onInsert={insertVar} customNames={customVarNames} />
            </div>
            <textarea
              ref={textRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              maxLength={2000}
              placeholder="문자 본문 (90 byte 이하 SMS, 제목·90 byte 초과 시 LMS). 변수: #{업체명} 등"
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900"
            />
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>한글 2byte · 영문/숫자 1byte</span>
              <span>
                <Badge tone={isLms ? 'warn' : 'slate'} className="mr-1">
                  {smsKindLabel(kind)}
                </Badge>
                {bytes} byte
              </span>
            </div>
            <VariablePanel bindings={bindings} excelAvailable={excelAvailable} onEdit={editBinding} />
          </div>

          {/* 우: 실시간 휴대폰 미리보기 */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">미리보기</Label>
              {list.length > 0 && (
                <select
                  value={Math.min(previewIdx, list.length - 1)}
                  onChange={(e) => setPreviewIdx(Number(e.target.value))}
                  className="h-7 max-w-[60%] rounded-md border border-slate-200 bg-white px-1.5 text-[11px] focus:outline-none dark:border-slate-700 dark:bg-slate-900"
                >
                  {list.map((addr, i) => (
                    <option key={addr} value={i}>
                      {addr}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="flex justify-center rounded-xl bg-slate-100 p-4 dark:bg-slate-800/60">
              <div className="w-full max-w-[260px] rounded-[1.6rem] border-4 border-slate-800 bg-white p-3 shadow-md dark:bg-slate-900">
                <div className="mb-2 text-center text-[10px] text-slate-400">{senderPhone}</div>
                <div className="rounded-2xl rounded-tl-sm bg-slate-100 px-3 py-2 text-[13px] leading-relaxed text-slate-800 dark:bg-slate-700 dark:text-slate-100">
                  {isLms && previewSubject && (
                    <div className="mb-1 font-bold">{previewSubject}</div>
                  )}
                  <div className="whitespace-pre-wrap break-words">
                    {previewText || <span className="italic text-slate-400">본문 미리보기…</span>}
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
                  <span>{smsKindLabel(kind)}</span>
                  <span>{byteLength((isLms && previewSubject ? previewSubject + '\n' : '') + previewText)} byte</span>
                </div>
              </div>
            </div>
            <div className="text-center text-[11px] text-slate-400">
              {recipientCount}명 · 예상비용 약 {estCost.toLocaleString()}원
            </div>
          </div>
        </div>

        <ReasonInput value={reason} onChange={setReason} />

        <WarningBox>
          실제 운영 문자가 즉시 발송됩니다(취소 불가). 발송 비용이 발생하며, 광고성 문자는 (광고) 표기·수신거부 안내 등
          법적 요건을 준수해야 합니다.
        </WarningBox>

        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setTestOpen(true)}>
            <FlaskConical className="h-4 w-4" />
            테스트 발송
          </Button>
          <Button type="button" onClick={send} disabled={pending}>
            <MessageSquare className="h-4 w-4" />
            {pending ? '발송 중…' : '문자 발송'}
          </Button>
        </div>
      </CardContent>

      {/* MSG-22 — 테스트 발송 모달 */}
      {testOpen && (
        <Modal title="테스트 발송" onClose={() => setTestOpen(false)} size="sm">
          <div className="flex flex-col gap-3">
            <p className="text-xs text-slate-500">
              샘플 수신자 1명 기준으로 변수가 치환되어 입력한 번호로 <b>1건</b> 발송됩니다. (메시지함에 기록되지 않음)
            </p>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">테스트 받을 번호</Label>
              <Input
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
                placeholder="010-0000-0000"
                className="h-9"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setTestOpen(false)}>
                취소
              </Button>
              <Button type="button" onClick={runTest} disabled={testPending}>
                <FlaskConical className="h-4 w-4" />
                {testPending ? '발송 중…' : '테스트 발송'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </Card>
  );
}
