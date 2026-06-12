'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Eye,
  EyeOff,
  ExternalLink,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useConfirmDialog } from '@/components/dialogs/confirm-dialog';
import {
  addHotelSolutionAction,
  deleteHotelSolutionAction,
  revealSolutionPasswordAction,
  updateHotelSolutionAction,
} from '@/app/actions/hotel-actions';
import type { HotelSolutionView, SolutionPresetOption } from '@/lib/services/hotels';

export function HotelSolutions({
  hotelId,
  solutions,
  presets,
}: {
  hotelId: string;
  solutions: HotelSolutionView[];
  presets: SolutionPresetOption[];
}) {
  const router = useRouter();
  const confirm = useConfirmDialog();
  const [pending, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Record<string, string>>({});

  async function handleReveal(id: string) {
    if (revealed[id] !== undefined) {
      // 숨기기
      setRevealed((p) => {
        const n = { ...p };
        delete n[id];
        return n;
      });
      return;
    }
    const fd = new FormData();
    fd.set('id', id);
    fd.set('hotelId', hotelId);
    const res = await revealSolutionPasswordAction(fd);
    if (res.ok && res.data) {
      setRevealed((p) => ({ ...p, [id]: res.data!.password }));
    } else {
      toast.error(res.ok ? '비밀번호가 없습니다' : res.error);
    }
  }

  async function handleDelete(s: HotelSolutionView) {
    const ok = await confirm({
      title: `'${s.label}' 솔루션을 삭제하시겠습니까?`,
      description: '저장된 로그인 정보도 함께 삭제됩니다.',
      confirmText: '삭제',
      tone: 'danger',
    });
    if (!ok) return;
    const fd = new FormData();
    fd.set('id', s.id);
    fd.set('hotelId', hotelId);
    startTransition(async () => {
      const res = await deleteHotelSolutionAction(fd);
      if (res.ok) {
        toast.success('삭제되었습니다');
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle>이용중 솔루션</CardTitle>
          <CardDescription>
            제품별 바로가기와 로그인 정보를 관리합니다. 비밀번호는 암호화 저장됩니다.
          </CardDescription>
        </div>
        {!showAdd && !editingId && (
          <Button size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4" />솔루션 추가
          </Button>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {showAdd && (
          <SolutionForm
            hotelId={hotelId}
            presets={presets}
            onDone={() => { setShowAdd(false); router.refresh(); }}
            onCancel={() => setShowAdd(false)}
          />
        )}

        {solutions.length === 0 && !showAdd ? (
          <p className="py-4 text-center text-sm text-slate-400 dark:text-slate-500">
            등록된 솔루션이 없습니다.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
            {solutions.map((s) =>
              editingId === s.id ? (
                <li key={s.id} className="py-3">
                  <SolutionForm
                    hotelId={hotelId}
                    presets={presets}
                    initial={s}
                    onDone={() => { setEditingId(null); router.refresh(); }}
                    onCancel={() => setEditingId(null)}
                  />
                </li>
              ) : (
                <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
                  <Badge tone="brand" className="shrink-0">{s.label}</Badge>
                  {s.url ? (
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline dark:text-brand-400"
                    >
                      바로가기 <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : (
                    <span className="text-sm text-slate-400 dark:text-slate-500">URL 없음</span>
                  )}
                  <span className="text-sm text-slate-600 dark:text-slate-300">
                    <span className="text-slate-400 dark:text-slate-500">ID</span>{' '}
                    {s.loginId || <span className="text-slate-400 dark:text-slate-500">-</span>}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
                    <span className="text-slate-400 dark:text-slate-500">PW</span>{' '}
                    {s.hasPassword ? (
                      <>
                        <span className="font-mono">
                          {revealed[s.id] !== undefined ? revealed[s.id] : '••••••'}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleReveal(s.id)}
                          className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-200"
                          aria-label={revealed[s.id] !== undefined ? '숨기기' : '보기'}
                        >
                          {revealed[s.id] !== undefined ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </>
                    ) : (
                      <span className="text-slate-400 dark:text-slate-500">-</span>
                    )}
                  </span>
                  <div className="ml-auto flex shrink-0 gap-1">
                    <Button type="button" size="sm" variant="ghost" onClick={() => { setEditingId(s.id); setShowAdd(false); }}>
                      <Pencil className="h-3.5 w-3.5" />수정
                    </Button>
                    <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => handleDelete(s)} className="text-red-600 hover:text-red-700 dark:text-red-400">
                      <Trash2 className="h-3.5 w-3.5" />삭제
                    </Button>
                  </div>
                </li>
              ),
            )}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function SolutionForm({
  hotelId,
  presets,
  initial,
  onDone,
  onCancel,
}: {
  hotelId: string;
  presets: SolutionPresetOption[];
  initial?: HotelSolutionView;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [presetId, setPresetId] = useState(initial?.presetId ?? '');
  const [label, setLabel] = useState(initial?.label ?? '');
  const [url, setUrl] = useState(initial?.url ?? '');
  const [loginId, setLoginId] = useState(initial?.loginId ?? '');
  const [password, setPassword] = useState('');
  const [clearPassword, setClearPassword] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const isEdit = !!initial;

  function onPresetChange(id: string) {
    setPresetId(id);
    const p = presets.find((x) => x.id === id);
    if (p) {
      setLabel(p.label);
      if (p.defaultUrlTemplate && !url) setUrl(p.defaultUrlTemplate);
    }
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!label.trim()) {
      toast.error('솔루션명을 입력해주세요');
      return;
    }
    const fd = new FormData();
    fd.set('hotelId', hotelId);
    fd.set('presetId', presetId);
    fd.set('label', label.trim());
    fd.set('url', url.trim());
    fd.set('loginId', loginId.trim());
    fd.set('password', password);
    if (isEdit) {
      fd.set('id', initial!.id);
      fd.set('clearPassword', clearPassword ? '1' : '');
    }
    startTransition(async () => {
      const res = isEdit
        ? await updateHotelSolutionAction(fd)
        : await addHotelSolutionAction(fd);
      if (res.ok) {
        toast.success(isEdit ? '수정되었습니다' : '솔루션이 추가되었습니다');
        onDone();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-md border border-dashed border-brand-400 bg-brand-50/30 p-4 dark:bg-brand-950/20 sm:grid-cols-2">
      <div className="col-span-full text-sm font-medium">
        {isEdit ? '솔루션 수정' : '솔루션 추가'}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>제품 선택</Label>
        <Select value={presetId} onChange={(e) => onPresetChange(e.target.value)}>
          <option value="">직접 입력</option>
          {presets.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>솔루션명 *</Label>
        <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="예: PMS" required />
      </div>
      <div className="col-span-full flex flex-col gap-1.5">
        <Label>바로가기 URL</Label>
        <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>로그인 ID</Label>
        <Input value={loginId} onChange={(e) => setLoginId(e.target.value)} autoComplete="off" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>비밀번호</Label>
        <div className="relative">
          <Input
            type={showPw ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            placeholder={isEdit && initial?.hasPassword ? '비워두면 기존 유지' : ''}
            disabled={clearPassword}
            className="pr-9"
          />
          <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" aria-label="비밀번호 표시 전환">
            {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {isEdit && initial?.hasPassword && (
          <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <input type="checkbox" checked={clearPassword} onChange={(e) => setClearPassword(e.target.checked)} />
            저장된 비밀번호 삭제
          </label>
        )}
      </div>
      <div className="col-span-full flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          <X className="h-4 w-4" />취소
        </Button>
        <Button type="submit" disabled={pending}>{pending ? '저장 중...' : '저장'}</Button>
      </div>
    </form>
  );
}
