'use client';

/**
 * 체크리스트 단계 편집기 — Phase 4 SF-04.
 *
 * - 활성 단계 리스트 + 인라인 편집 + 신규 추가
 * - 위/아래 화살표로 step_no swap
 * - 비활성/복구 가능 (물리 삭제 금지)
 * - 단계 본문은 RichEditor 통합 (Phase 2)
 */

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Pencil,
  Plus,
  Save,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MarkdownView } from '@/components/articles/markdown-view';
import { RichEditor } from '@/components/editor/rich-editor';
import { deleteDraftAfterPublish } from '@/lib/editor/draft-client';
import { useConfirmDialog } from '@/components/dialogs/confirm-dialog';
import {
  archiveStepAction,
  createStepAction,
  moveStepOrderAction,
  restoreStepAction,
  updateStepAction,
} from '@/app/actions/checklist-actions';
import type { ChecklistStep, ChecklistStepAction } from '@/db/schema';

const ACTION_OPTIONS: Array<{ value: ChecklistStepAction; label: string }> = [
  { value: 'next', label: '다음 단계' },
  { value: 'resolved', label: '해결됨 (종료)' },
  { value: 'escalate', label: '접수 필요 (종료)' },
];

type StepFormState = {
  title: string;
  bodyMarkdown: string;
  conditionYesAction: ChecklistStepAction;
  conditionNoAction: ChecklistStepAction;
  yesLabel: string;
  noLabel: string;
};

const EMPTY_FORM: StepFormState = {
  title: '',
  bodyMarkdown: '',
  conditionYesAction: 'next',
  conditionNoAction: 'escalate',
  yesLabel: '예',
  noLabel: '아니오',
};

export function ChecklistStepsEditor({
  checklistId,
  steps,
}: {
  checklistId: string;
  steps: ChecklistStep[];
}) {
  const router = useRouter();
  const confirm = useConfirmDialog();
  const [pending, startTransition] = useTransition();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<StepFormState>(EMPTY_FORM);

  const sorted = [...steps].sort((a, b) => a.stepNo - b.stepNo);

  function startEdit(step: ChecklistStep) {
    setCreating(false);
    setEditingId(step.id);
    setForm({
      title: step.title,
      bodyMarkdown: step.bodyMarkdown ?? '',
      conditionYesAction: step.conditionYesAction,
      conditionNoAction: step.conditionNoAction,
      yesLabel: step.yesLabel,
      noLabel: step.noLabel,
    });
  }

  function startCreate() {
    setEditingId(null);
    setCreating(true);
    setForm(EMPTY_FORM);
  }

  function cancel() {
    setEditingId(null);
    setCreating(false);
    setForm(EMPTY_FORM);
  }

  function submitForm() {
    if (!form.title.trim()) {
      toast.error('단계 제목을 입력하세요.');
      return;
    }
    const formData = new FormData();
    formData.set('title', form.title.trim());
    formData.set('bodyMarkdown', form.bodyMarkdown);
    formData.set('conditionYesAction', form.conditionYesAction);
    formData.set('conditionNoAction', form.conditionNoAction);
    formData.set('yesLabel', form.yesLabel.trim() || '예');
    formData.set('noLabel', form.noLabel.trim() || '아니오');

    startTransition(async () => {
      const result = creating
        ? await createStepAction(checklistId, formData)
        : await updateStepAction(editingId!, checklistId, formData);
      if (result.ok) {
        // 편집 모드 draft 삭제 (신규 단계는 nonce 모름, 자연 만료)
        await deleteDraftAfterPublish('checklist-step', editingId);
        toast.success(creating ? '단계가 추가되었습니다' : '단계가 저장되었습니다');
        cancel();
        router.refresh();
      } else {
        toast.error(result.message ?? '저장 실패');
      }
    });
  }

  async function handleArchive(step: ChecklistStep) {
    const ok = await confirm({
      title: '이 단계를 비활성 처리하시겠습니까?',
      description: `"${step.title}"이(가) 진행 중 자동으로 건너뛰어집니다. 데이터는 보존되며 복구 가능합니다.`,
      confirmText: '비활성',
      tone: 'danger',
    });
    if (!ok) return;
    startTransition(async () => {
      const r = await archiveStepAction(step.id, checklistId);
      if (r.ok) {
        toast.success('비활성 처리되었습니다');
        router.refresh();
      } else toast.error(r.message ?? '처리 실패');
    });
  }

  function handleRestore(step: ChecklistStep) {
    startTransition(async () => {
      const r = await restoreStepAction(step.id, checklistId);
      if (r.ok) {
        toast.success('복구되었습니다');
        router.refresh();
      } else toast.error(r.message ?? '처리 실패');
    });
  }

  function handleMove(step: ChecklistStep, direction: 'up' | 'down') {
    startTransition(async () => {
      const r = await moveStepOrderAction(step.id, checklistId, direction);
      if (r.ok) router.refresh();
      else if (r.message === 'NO_NEIGHBOR')
        toast.info('인접한 활성 단계가 없습니다.');
      else toast.error(r.message ?? '이동 실패');
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">단계 편집</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            활성 단계 {sorted.filter((s) => s.isActive).length}개 / 전체 {sorted.length}개
          </p>
        </div>
        {!creating && !editingId && (
          <Button onClick={startCreate} size="sm">
            <Plus className="h-3.5 w-3.5" />
            단계 추가
          </Button>
        )}
      </div>

      {creating && (
        <StepForm
          mode="create"
          form={form}
          setForm={setForm}
          onSubmit={submitForm}
          onCancel={cancel}
          pending={pending}
          targetId={null}
        />
      )}

      {sorted.length === 0 && !creating && (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              아직 단계가 없습니다. "단계 추가"로 첫 단계를 만드세요.
            </p>
          </CardContent>
        </Card>
      )}

      <ul className="flex flex-col gap-2">
        {sorted.map((step) => (
          <li key={step.id}>
            {editingId === step.id ? (
              <StepForm
                mode="edit"
                form={form}
                setForm={setForm}
                onSubmit={submitForm}
                onCancel={cancel}
                pending={pending}
                targetId={step.id}
              />
            ) : (
              <Card className={step.isActive ? '' : 'opacity-60'}>
                <CardContent className="flex flex-col gap-2 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-1 items-start gap-3">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                        {step.stepNo}
                      </div>
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <h3 className="font-semibold">{step.title}</h3>
                          {!step.isActive && (
                            <Badge tone="danger">비활성</Badge>
                          )}
                        </div>
                        {step.bodyMarkdown && (
                          <details className="mt-1">
                            <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-800">
                              본문 보기
                            </summary>
                            <div className="mt-2 rounded border border-slate-100 p-2 dark:border-slate-800">
                              <MarkdownView
                                source={step.bodyMarkdown}
                                className="text-sm"
                              />
                            </div>
                          </details>
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span>
                            <strong>{step.yesLabel}</strong> →{' '}
                            {actionLabel(step.conditionYesAction)}
                          </span>
                          <span className="text-slate-300">·</span>
                          <span>
                            <strong>{step.noLabel}</strong> →{' '}
                            {actionLabel(step.conditionNoAction)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        title="앞으로"
                        disabled={pending || !step.isActive}
                        onClick={() => handleMove(step, 'up')}
                        className="h-7 w-7"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        title="뒤로"
                        disabled={pending || !step.isActive}
                        onClick={() => handleMove(step, 'down')}
                        className="h-7 w-7"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        title="편집"
                        disabled={pending}
                        onClick={() => startEdit(step)}
                        className="h-7 w-7"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      {step.isActive ? (
                        <Button
                          size="icon"
                          variant="ghost"
                          title="비활성"
                          disabled={pending}
                          onClick={() => handleArchive(step)}
                          className="h-7 w-7"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      ) : (
                        <Button
                          size="icon"
                          variant="ghost"
                          title="복구"
                          disabled={pending}
                          onClick={() => handleRestore(step)}
                          className="h-7 w-7"
                        >
                          <Undo2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function StepForm({
  mode,
  form,
  setForm,
  onSubmit,
  onCancel,
  pending,
  targetId,
}: {
  mode: 'create' | 'edit';
  form: StepFormState;
  setForm: (next: StepFormState) => void;
  onSubmit: () => void;
  onCancel: () => void;
  pending: boolean;
  /** 편집 시 step.id, 신규 시 null (자동저장 scope 분기) */
  targetId: string | null;
}) {
  return (
    <Card className="border-brand-300 dark:border-brand-700">
      <CardContent className="grid gap-3 p-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="step-title">단계 제목 *</Label>
          <Input
            id="step-title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            maxLength={200}
            placeholder="예: 단말 상태에 '준비' 표시가 있나요?"
          />
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label>본문 (선택)</Label>
          <RichEditor
            mode="full"
            value={form.bodyMarkdown}
            onChange={(md) => setForm({ ...form, bodyMarkdown: md })}
            minHeight={160}
            placeholder="부가 설명이나 확인 방법을 적어주세요."
            autoSave={{
              scope: 'checklist-step',
              targetId,
            }}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>예 버튼 라벨</Label>
          <Input
            value={form.yesLabel}
            onChange={(e) => setForm({ ...form, yesLabel: e.target.value })}
            maxLength={40}
            placeholder="예"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>예 클릭 시 동작</Label>
          <Select
            value={form.conditionYesAction}
            onChange={(e) =>
              setForm({
                ...form,
                conditionYesAction: e.target.value as ChecklistStepAction,
              })
            }
          >
            {ACTION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>아니오 버튼 라벨</Label>
          <Input
            value={form.noLabel}
            onChange={(e) => setForm({ ...form, noLabel: e.target.value })}
            maxLength={40}
            placeholder="아니오"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>아니오 클릭 시 동작</Label>
          <Select
            value={form.conditionNoAction}
            onChange={(e) =>
              setForm({
                ...form,
                conditionNoAction: e.target.value as ChecklistStepAction,
              })
            }
          >
            {ACTION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={pending}
          >
            <X className="h-3.5 w-3.5" />
            취소
          </Button>
          <Button type="button" size="sm" onClick={onSubmit} disabled={pending}>
            <Save className="h-3.5 w-3.5" />
            {mode === 'create' ? '단계 추가' : '단계 저장'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function actionLabel(a: ChecklistStepAction): string {
  switch (a) {
    case 'next':
      return '다음 단계';
    case 'resolved':
      return '해결됨';
    case 'escalate':
      return '접수 필요';
  }
}
