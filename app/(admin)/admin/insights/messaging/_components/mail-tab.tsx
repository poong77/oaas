'use client';

/**
 * 메일 탭 (SES).
 * - MSG-20: 발신자명 + 발신자 주소 한 줄
 * - MSG-15: 변수 값 패널
 * - MSG-21: 미리보기 모달 (발신자·제목·본문·푸터 렌더)
 * - MSG-22: 테스트 발송
 */

import { useCallback, useMemo, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Mail, Sparkles, Eye, FlaskConical } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RichEditor } from '@/components/editor/rich-editor';
import { useConfirmDialog } from '@/components/dialogs/confirm-dialog';
import { markdownToHtml } from '@/lib/editor/markdown-to-html';
import {
  MAIL_FOOTER,
  extractVarNames,
  resolveRecipientVars,
  substituteAll,
} from '@/lib/messaging/format';
import {
  aiWriteEmailAction,
  sendBulkEmailAction,
  sendTestEmailAction,
} from '@/app/actions/messaging-actions';
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

export function MailTab({
  senderEmailLocal,
  seed,
}: {
  senderEmailLocal: string;
  seed?: TemplateSeed | null;
}) {
  const confirm = useConfirmDialog();
  const [pending, startTransition] = useTransition();
  const [aiPending, startAi] = useTransition();
  const [testPending, startTest] = useTransition();

  const [fromName, setFromName] = useState(seed?.fromName ?? '오아테크');
  const [fromLocal, setFromLocal] = useState(seed?.fromLocal ?? senderEmailLocal);
  const [recipients, setRecipients] = useState('');
  const [meta, setMeta] = useState<MetaMap>({});
  const [subject, setSubject] = useState(seed?.subject ?? '');
  const [body, setBody] = useState(seed?.body ?? '');
  const [reason, setReason] = useState('');
  const [varOverrides, setVarOverrides] = useState<Record<string, { source: VarSource; value: string }>>(
    () => Object.fromEntries((seed?.variables ?? []).map((v) => [v.name, { source: v.source, value: '' }])),
  );
  const [customVarNames, setCustomVarNames] = useState<string[]>(
    () => (seed?.variables ?? []).map((v) => v.name),
  );
  const [excelAvailable, setExcelAvailable] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [testTo, setTestTo] = useState('');

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
    setBody((b) => (b.length === 0 || b.endsWith('\n') || b.endsWith(' ') ? b + token : b + ' ' + token));
  }

  function editBinding(name: string, patch: Partial<{ source: VarSource; value: string }>) {
    setVarOverrides((prev) => {
      const cur = prev[name] ?? { source: 'auto' as VarSource, value: '' };
      return { ...prev, [name]: { ...cur, ...patch } };
    });
  }

  const usedNames = useMemo(() => extractVarNames(subject, body), [subject, body]);
  const bindings = useMemo(() => effectiveBindings(usedNames, varOverrides), [usedNames, varOverrides]);

  /** 샘플 수신자 1명 기준 치환 값 (미리보기·테스트용). */
  const sampleValues = useMemo(() => {
    const list = parseRecipients(recipients);
    const sample = list[0] ? buildSendRecipients([list[0]], meta)[0] : undefined;
    return resolveRecipientVars(
      bindings.map((b) => ({ name: b.name, source: b.source, value: b.value })),
      { auto: sample?.auto, excel: sample?.excel },
    );
  }, [recipients, meta, bindings]);

  const fromEmail = `${(fromLocal.trim() || 'as')}@oapms.com`;
  const fromPreview = fromName.trim() ? `${fromName.trim()} <${fromEmail}>` : fromEmail;

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

  function runTest() {
    if (!testTo.trim()) return toast.error('테스트 받을 이메일을 입력하세요');
    if (subject.trim().length === 0) return toast.error('제목을 입력하세요');
    if (body.trim().length === 0) return toast.error('본문을 입력하세요');
    startTest(async () => {
      const res = await sendTestEmailAction({
        to: testTo.trim(),
        fromLocal: fromLocal.trim() || undefined,
        fromName: fromName.trim() || undefined,
        subject: subject.trim(),
        markdown: body.trim(),
        sampleValues,
      });
      if (!res.ok) {
        toast.error(res.message ?? '테스트 발송 실패');
        return;
      }
      toast.success(`테스트 메일을 ${testTo.trim()}로 발송했습니다`);
      setTestOpen(false);
    });
  }

  async function send() {
    const list = parseRecipients(recipients);
    if (list.length === 0) return toast.error('수신자를 입력하세요');
    if (subject.trim().length === 0) return toast.error('제목을 입력하세요');
    if (body.trim().length === 0) return toast.error('본문을 입력하세요');

    const ok = await confirm({
      title: `메일 ${list.length}명에게 발송`,
      description: `발신: ${fromPreview}\n실제 운영 메일이 발송됩니다. 수신자와 본문을 확인하셨나요?`,
      confirmText: '발송',
      tone: 'danger',
    });
    if (!ok) return;

    startTransition(async () => {
      const res = await sendBulkEmailAction({
        recipients: buildSendRecipients(list, meta),
        fromLocal: fromLocal.trim() || undefined,
        fromName: fromName.trim() || undefined,
        subject: subject.trim(),
        markdown: body.trim(),
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
        {/* MSG-20 — 발신자명 + 발신자 주소 한 줄 */}
        <div className="flex flex-col gap-1">
          <Label className="text-xs">발신자</Label>
          <div className="flex flex-wrap items-stretch gap-2">
            <Input
              value={fromName}
              onChange={(e) => setFromName(e.target.value.slice(0, 64))}
              placeholder="발신자명 (예: 오아테크)"
              className="h-9 w-[160px]"
            />
            <div className="flex items-stretch">
              <Input
                value={fromLocal}
                onChange={(e) => setFromLocal(e.target.value.replace(/[^a-zA-Z0-9._-]/g, ''))}
                placeholder="as"
                className="h-9 w-[120px] rounded-r-none font-mono"
              />
              <span className="inline-flex items-center rounded-r-md border border-l-0 border-slate-200 bg-slate-100 px-3 font-mono text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800">
                @oapms.com
              </span>
            </div>
          </div>
          <span className="text-[11px] text-slate-400">
            미리보기: <span className="font-mono text-brand-600 dark:text-brand-400">{fromPreview}</span> · 도메인 @oapms.com 고정
          </span>
        </div>

        <RecipientPicker
          mode="email"
          value={recipients}
          onChange={setRecipients}
          onMeta={addMeta}
          onVarNames={registerVarNames}
        />

        <div className="flex flex-col gap-1">
          <Label className="text-xs">제목 <span className="text-red-500">*</span></Label>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={200}
            placeholder="메일 제목 (변수 사용 가능: #{업체명} 등)"
            className="h-9"
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <Label className="text-xs">본문</Label>
              <VariableChips onInsert={insertVar} customNames={customVarNames} />
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
          <VariablePanel bindings={bindings} excelAvailable={excelAvailable} onEdit={editBinding} />
          <MailFooterPreview />
        </div>

        <ReasonInput value={reason} onChange={setReason} />

        <WarningBox>
          실제 운영 메일이 즉시 발송됩니다(취소 불가). 본문 하단에 회사 푸터가 자동 첨부되며, 변수(#{'{'}업체명{'}'} 등)는
          수신자별 실제 값으로 치환됩니다. 발송 전 <b>미리보기</b>·<b>테스트 발송</b>으로 확인하세요.
        </WarningBox>

        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setPreviewOpen(true)}>
            <Eye className="h-4 w-4" />
            미리보기
          </Button>
          <Button type="button" variant="outline" onClick={() => setTestOpen(true)}>
            <FlaskConical className="h-4 w-4" />
            테스트 발송
          </Button>
          <Button type="button" onClick={send} disabled={pending}>
            <Mail className="h-4 w-4" />
            {pending ? '발송 중…' : '메일 발송'}
          </Button>
        </div>
      </CardContent>

      {/* MSG-21 — 미리보기 모달 */}
      {previewOpen && (
        <Modal title="메일 미리보기 (샘플 수신자 기준)" onClose={() => setPreviewOpen(false)} size="xl">
          <div className="flex flex-col gap-3">
            <div className="rounded-md border border-slate-200 p-3 text-sm dark:border-slate-700">
              <div className="text-xs text-slate-500">보내는 사람</div>
              <div className="font-mono text-slate-700 dark:text-slate-200">{fromPreview}</div>
              <div className="mt-2 text-xs text-slate-500">제목</div>
              <div className="font-medium text-slate-800 dark:text-slate-100">
                {substituteAll(subject, sampleValues) || <span className="italic text-slate-400">(제목 없음)</span>}
              </div>
            </div>
            <div
              className="prose prose-sm max-w-none rounded-md border border-slate-200 bg-white p-4 dark:prose-invert dark:border-slate-700 dark:bg-slate-900"
              dangerouslySetInnerHTML={{ __html: markdownToHtml(substituteAll(body, sampleValues)) }}
            />
            <MailFooterPreview />
            {usedNames.some((n) => !sampleValues[n]) && (
              <p className="text-xs text-amber-600">
                ⚠ 일부 변수에 샘플 값이 없습니다(빈 문자열로 치환). 변수 값 소스를 확인하세요.
              </p>
            )}
          </div>
        </Modal>
      )}

      {/* MSG-22 — 테스트 발송 모달 */}
      {testOpen && (
        <Modal title="테스트 발송" onClose={() => setTestOpen(false)} size="sm">
          <div className="flex flex-col gap-3">
            <p className="text-xs text-slate-500">
              샘플 수신자 1명 기준으로 변수가 치환되어 입력한 주소로 <b>1건</b> 발송됩니다. (메시지함에 기록되지 않음)
            </p>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">테스트 받을 이메일</Label>
              <Input
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
                placeholder="me@oapms.com"
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
