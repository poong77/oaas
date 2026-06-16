'use client';

/**
 * MSG-16 — 발송 템플릿 탭.
 * 리스트(드래그 정렬·채널배지·제목·메모·사용/수정/삭제) + 팝업 모달 에디터.
 */

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, GripVertical, Send, Mail, MessageSquare } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { RichEditor } from '@/components/editor/rich-editor';
import { useConfirmDialog } from '@/components/dialogs/confirm-dialog';
import {
  listManualTemplatesAction,
  saveManualTemplateAction,
  deleteManualTemplateAction,
  reorderManualTemplatesAction,
  type ManualTemplate,
} from '@/app/actions/messaging-actions';
import type { VarSource } from '@/lib/messaging/format';
import { Modal, VariableChips, type TemplateSeed } from './shared';

type EditorState = {
  id?: string;
  channel: 'email' | 'sms';
  title: string;
  memo: string;
  subject: string;
  body: string;
  fromName: string;
  fromLocal: string;
  variables: Array<{ name: string; source: VarSource }>;
};

function emptyEditor(channel: 'email' | 'sms'): EditorState {
  return {
    channel,
    title: '',
    memo: '',
    subject: channel === 'sms' ? '[오아테크]' : '',
    body: '',
    fromName: channel === 'email' ? '오아테크' : '',
    fromLocal: channel === 'email' ? 'as' : '',
    variables: [],
  };
}

export function TemplateTab({ onUse }: { onUse: (seed: TemplateSeed) => void }) {
  const confirm = useConfirmDialog();
  const [items, setItems] = useState<ManualTemplate[]>([]);
  const [loading, startLoading] = useTransition();
  const [editor, setEditor] = useState<EditorState | null>(null);
  const dragId = useRef<string | null>(null);

  const load = useCallback(() => {
    startLoading(async () => {
      const res = await listManualTemplatesAction();
      if (!res.ok) {
        toast.error(res.message ?? '템플릿 조회 실패');
        return;
      }
      setItems(res.items ?? []);
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function useTemplate(t: ManualTemplate) {
    onUse({
      channel: t.channel,
      subject: t.subject ?? '',
      body: t.body,
      fromName: t.fromName,
      fromLocal: t.fromLocal,
      variables: t.variables,
    });
    toast.success(`'${t.title}' 템플릿을 ${t.channel === 'email' ? '메일' : '문자'} 탭에 적용했습니다`);
  }

  async function remove(t: ManualTemplate) {
    const ok = await confirm({
      title: '템플릿 삭제',
      description: `'${t.title}' 템플릿을 삭제하시겠습니까?`,
      confirmText: '삭제',
      tone: 'danger',
    });
    if (!ok) return;
    const res = await deleteManualTemplateAction({ id: t.id });
    if (!res.ok) {
      toast.error(res.message ?? '삭제 실패');
      return;
    }
    toast.success('삭제되었습니다');
    load();
  }

  // 드래그 정렬
  function onDrop(targetId: string) {
    const sourceId = dragId.current;
    dragId.current = null;
    if (!sourceId || sourceId === targetId) return;
    const ids = items.map((i) => i.id);
    const from = ids.indexOf(sourceId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setItems(next);
    void reorderManualTemplatesAction({ orderedIds: next.map((i) => i.id) }).then((r) => {
      if (!r.ok) toast.error('정렬 저장 실패');
    });
  }

  const empty = !loading && items.length === 0;

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-500">
            자주 쓰는 발송 양식을 등록해 두고, 발송 시 수신정보·변수값만 교체하세요.
          </span>
          <Button type="button" size="sm" onClick={() => setEditor(emptyEditor('email'))}>
            <Plus className="h-4 w-4" />
            새 템플릿
          </Button>
        </div>

        {empty ? (
          <EmptyState
            icon={<Send className="h-8 w-8" />}
            title="등록된 템플릿이 없습니다"
            description="‘새 템플릿’으로 자주 쓰는 메일·문자 양식을 등록하세요."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {items.map((t) => (
              <div
                key={t.id}
                draggable
                onDragStart={() => (dragId.current = t.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDrop(t.id)}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"
              >
                <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-slate-300" />
                {t.channel === 'email' ? (
                  <Badge tone="brand">메일</Badge>
                ) : (
                  <Badge tone="slate">문자</Badge>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{t.title}</div>
                  {t.memo && <div className="truncate text-xs text-slate-400">{t.memo}</div>}
                </div>
                <button
                  type="button"
                  onClick={() => useTemplate(t)}
                  className="inline-flex items-center gap-1 rounded-md border border-brand-200 bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700 transition hover:bg-brand-100 dark:border-brand-800 dark:bg-brand-950/40 dark:text-brand-300"
                >
                  <Send className="h-3.5 w-3.5" />
                  사용
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setEditor({
                      id: t.id,
                      channel: t.channel,
                      title: t.title,
                      memo: t.memo ?? '',
                      subject: t.subject ?? '',
                      body: t.body,
                      fromName: t.fromName ?? '',
                      fromLocal: t.fromLocal ?? '',
                      variables: t.variables,
                    })
                  }
                  title="수정"
                  className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => remove(t)}
                  title="삭제"
                  className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {editor && (
        <TemplateEditorModal
          state={editor}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            load();
          }}
        />
      )}
    </Card>
  );
}

function TemplateEditorModal({
  state,
  onClose,
  onSaved,
}: {
  state: EditorState;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [s, setS] = useState<EditorState>(state);
  const [newVar, setNewVar] = useState('');
  const [saving, startSave] = useTransition();
  const textRef = useRef<HTMLTextAreaElement>(null);

  function patch(p: Partial<EditorState>) {
    setS((prev) => ({ ...prev, ...p }));
  }

  function insertVar(token: string) {
    if (s.channel === 'email') {
      setS((prev) => ({
        ...prev,
        body: prev.body.length === 0 || prev.body.endsWith('\n') || prev.body.endsWith(' ') ? prev.body + token : prev.body + ' ' + token,
      }));
      return;
    }
    const el = textRef.current;
    if (!el) {
      setS((prev) => ({ ...prev, body: prev.body + token }));
      return;
    }
    const start = el.selectionStart ?? s.body.length;
    const end = el.selectionEnd ?? s.body.length;
    const next = s.body.slice(0, start) + token + s.body.slice(end);
    setS((prev) => ({ ...prev, body: next }));
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  }

  function addVar() {
    const name = newVar.trim();
    if (!name) return;
    if (s.variables.some((v) => v.name === name)) {
      toast.error('이미 등록된 변수명');
      return;
    }
    if (s.variables.length >= 7) {
      toast.error('커스텀 변수는 최대 7개');
      return;
    }
    patch({ variables: [...s.variables, { name, source: 'excel' }] });
    setNewVar('');
  }

  function removeVar(name: string) {
    patch({ variables: s.variables.filter((v) => v.name !== name) });
  }

  function save() {
    if (s.title.trim().length === 0) return toast.error('제목을 입력하세요');
    if (s.body.trim().length === 0) return toast.error('본문을 입력하세요');
    startSave(async () => {
      const res = await saveManualTemplateAction({
        id: s.id,
        channel: s.channel,
        title: s.title.trim(),
        memo: s.memo.trim() || null,
        subject: s.subject.trim() || null,
        body: s.body.trim(),
        fromName: s.channel === 'email' ? s.fromName.trim() || null : null,
        fromLocal: s.channel === 'email' ? s.fromLocal.trim() || null : null,
        variables: s.variables,
      });
      if (!res.ok) {
        toast.error(res.message ?? '저장 실패');
        return;
      }
      toast.success(s.id ? '템플릿을 수정했습니다' : '템플릿을 등록했습니다');
      onSaved();
    });
  }

  const customNames = s.variables.map((v) => v.name);

  return (
    <Modal title={s.id ? '템플릿 수정' : '새 템플릿'} onClose={onClose} size="xl">
      <div className="flex flex-col gap-3">
        {/* 채널 */}
        <div className="flex flex-col gap-1">
          <Label className="text-xs">채널</Label>
          <div className="inline-flex overflow-hidden rounded-md border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => patch({ channel: 'email' })}
              className={'inline-flex items-center gap-1 px-3 py-1.5 text-xs ' + (s.channel === 'email' ? 'bg-brand-600 text-white' : 'text-slate-500')}
            >
              <Mail className="h-3.5 w-3.5" /> 메일
            </button>
            <button
              type="button"
              onClick={() => patch({ channel: 'sms', subject: s.subject || '[오아테크]' })}
              className={'inline-flex items-center gap-1 px-3 py-1.5 text-xs ' + (s.channel === 'sms' ? 'bg-brand-600 text-white' : 'text-slate-500')}
            >
              <MessageSquare className="h-3.5 w-3.5" /> 문자
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <Label className="text-xs">제목(템플릿명) <span className="text-red-500">*</span></Label>
            <Input value={s.title} onChange={(e) => patch({ title: e.target.value })} maxLength={120} className="h-9" placeholder="예: 정기 점검 안내" />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">메모(요약)</Label>
            <Input value={s.memo} onChange={(e) => patch({ memo: e.target.value })} maxLength={300} className="h-9" placeholder="리스트에 표시될 한 줄 요약" />
          </div>
        </div>

        {s.channel === 'email' && (
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1">
              <Label className="text-xs">발신자명</Label>
              <Input value={s.fromName} onChange={(e) => patch({ fromName: e.target.value.slice(0, 64) })} className="h-9 w-[150px]" placeholder="오아테크" />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">발신자 주소</Label>
              <div className="flex items-stretch">
                <Input value={s.fromLocal} onChange={(e) => patch({ fromLocal: e.target.value.replace(/[^a-zA-Z0-9._-]/g, '') })} className="h-9 w-[100px] rounded-r-none font-mono" placeholder="as" />
                <span className="inline-flex items-center rounded-r-md border border-l-0 border-slate-200 bg-slate-100 px-2 font-mono text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800">@oapms.com</span>
              </div>
            </div>
          </div>
        )}

        {/* 제목(메일 본문 제목 / 문자 제목) */}
        <div className="flex flex-col gap-1">
          <Label className="text-xs">{s.channel === 'email' ? '메일 제목' : '문자 제목'}{s.channel === 'sms' && <span className="text-red-500"> *</span>}</Label>
          <Input value={s.subject} onChange={(e) => patch({ subject: e.target.value })} maxLength={s.channel === 'sms' ? 40 : 200} className="h-9" placeholder={s.channel === 'sms' ? '[오아테크]' : '메일 제목'} />
        </div>

        {/* 본문 + 변수칩 */}
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <Label className="text-xs">본문 <span className="text-red-500">*</span></Label>
            <VariableChips onInsert={insertVar} customNames={customNames} />
          </div>
          {s.channel === 'email' ? (
            <RichEditor mode="full" value={s.body} onChange={(v) => patch({ body: v })} minHeight={180} placeholder="메일 본문" />
          ) : (
            <textarea
              ref={textRef}
              value={s.body}
              onChange={(e) => patch({ body: e.target.value })}
              rows={6}
              maxLength={2000}
              placeholder="문자 본문. 변수: #{업체명} 등"
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900"
            />
          )}
        </div>

        {/* 변수명 추가 (커스텀 변수1~7) */}
        <div className="flex flex-col gap-1.5 rounded-md border border-slate-200 p-3 dark:border-slate-700">
          <Label className="text-xs">변수명 추가 <span className="font-normal text-slate-400">(엑셀 열과 연결되는 커스텀 변수, 최대 7개)</span></Label>
          <div className="flex gap-2">
            <Input
              value={newVar}
              onChange={(e) => setNewVar(e.target.value.slice(0, 40))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addVar();
                }
              }}
              placeholder="예: 객실수"
              className="h-8 max-w-[200px] text-xs"
            />
            <Button type="button" variant="outline" size="sm" onClick={addVar}>
              <Plus className="h-3.5 w-3.5" /> 추가
            </Button>
          </div>
          {s.variables.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {s.variables.map((v) => (
                <span key={v.name} className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-mono text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                  #{`{${v.name}}`}
                  <button type="button" onClick={() => removeVar(v.name)} className="text-amber-500 hover:text-red-600">
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose}>
            취소
          </Button>
          <Button type="button" onClick={save} disabled={saving}>
            {saving ? '저장 중…' : '저장'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
