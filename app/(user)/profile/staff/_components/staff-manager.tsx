'use client';

import { useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Plus, UserPlus2, X, Check, Loader2 } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { useConfirmDialog } from '@/components/dialogs/confirm-dialog';
import {
  createStaffAction,
  updateStaffAction,
  toggleStaffActiveAction,
  checkUsernameAvailableAction,
} from '@/app/actions/staff-actions';
import type { User } from '@/db/schema';

/** 이메일/이름에서 로그인 ID 추천값 도출(영문/숫자만). */
function suggestUsername(seed: string): string {
  return seed
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '')
    .replace(/^[._-]+|[._-]+$/g, '')
    .slice(0, 20);
}

type UsernameStatus = 'idle' | 'checking' | 'ok' | 'taken' | 'invalid';

export function StaffManager({
  initialStaff,
  myUserId,
}: {
  initialStaff: User[];
  myUserId: string;
}) {
  const confirm = useConfirmDialog();
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  // C3 — 로그인 ID 자동 제안 + 실시간 중복 체크
  const [username, setUsername] = useState('');
  const [usernameTouched, setUsernameTouched] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function checkUsername(value: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const v = value.trim();
    if (!v) {
      setUsernameStatus('idle');
      return;
    }
    if (!/^[a-zA-Z0-9._-]{3,30}$/.test(v)) {
      setUsernameStatus('invalid');
      return;
    }
    setUsernameStatus('checking');
    debounceRef.current = setTimeout(async () => {
      const res = await checkUsernameAvailableAction(v);
      // 입력이 그새 바뀌었으면 무시
      setUsername((cur) => {
        if (cur.trim() !== v) return cur;
        setUsernameStatus(
          res.available ? 'ok' : res.reason === 'invalid' ? 'invalid' : 'taken',
        );
        return cur;
      });
    }, 400);
  }

  function onUsernameInput(v: string) {
    setUsernameTouched(true);
    setUsername(v);
    checkUsername(v);
  }

  function onSeedChange(seed: string) {
    // username을 사용자가 직접 만지지 않았을 때만 자동 제안
    if (usernameTouched) return;
    const sug = suggestUsername(seed);
    if (sug.length >= 3) {
      setUsername(sug);
      checkUsername(sug);
    }
  }

  function resetCreate() {
    setUsername('');
    setUsernameTouched(false);
    setUsernameStatus('idle');
    setErrors({});
  }

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    const form = e.currentTarget;
    const formData = new FormData(form);
    formData.set('username', username.trim());
    const email = (formData.get('email') ?? '').toString().trim();
    const phone = (formData.get('phone') ?? '').toString().trim();
    if (!email && !phone) {
      setErrors({ email: '이메일 또는 연락처 중 하나는 입력해주세요' });
      return;
    }
    if (usernameStatus === 'taken' || usernameStatus === 'invalid') {
      setErrors({
        username:
          usernameStatus === 'taken'
            ? '이미 사용 중인 로그인 ID입니다'
            : '로그인 ID는 영문/숫자/._- 3~30자입니다',
      });
      return;
    }
    startTransition(async () => {
      const res = await createStaffAction(formData);
      if (res.ok && res.data) {
        const sent = [
          res.data.emailSent && '이메일',
          res.data.smsSent && 'SMS',
        ].filter(Boolean) as string[];
        toast.success(`${formData.get('name')}님을 초대했습니다`, {
          description:
            sent.length > 0
              ? `로그인 ID ${res.data.username} · 임시 비밀번호는 ${sent.join('·')}로 발송되었습니다`
              : `로그인 ID ${res.data.username} · 발송에 실패했습니다. 임시 비밀번호: ${res.data.tempPassword} (직접 전달)`,
          duration: 12000,
        });
        form.reset();
        resetCreate();
        setShowCreate(false);
      } else if (!res.ok) {
        if (res.fields) setErrors(res.fields);
        toast.error(res.error);
      }
    });
  }

  function handleUpdate(e: React.FormEvent<HTMLFormElement>) {
    if (!editing) return;
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set('id', editing.id);
    startTransition(async () => {
      const res = await updateStaffAction(formData);
      if (res.ok) {
        toast.success('수정되었습니다');
        setEditing(null);
      } else {
        toast.error(res.error);
      }
    });
  }

  // C1 — 수정 모달 안에서 비활성화/활성화 (오프보딩 보존)
  async function handleToggleActive() {
    if (!editing) return;
    const target = !editing.isActive;
    const ok = await confirm({
      title: target ? '계정을 활성화합니다' : '계정을 비활성화합니다',
      description: target
        ? '다시 로그인할 수 있게 됩니다.'
        : '비활성화하면 해당 계정으로 로그인할 수 없습니다. 이력은 보존됩니다.',
      confirmText: target ? '활성화' : '비활성화',
      tone: target ? 'default' : 'danger',
    });
    if (!ok) return;
    const fd = new FormData();
    fd.set('id', editing.id);
    startTransition(async () => {
      const res = await toggleStaffActiveAction(fd);
      if (res.ok) {
        toast.success(target ? '활성화되었습니다' : '비활성화되었습니다');
        setEditing(null);
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div>
          <CardTitle>직원 목록</CardTitle>
          <CardDescription>호텔에 등록된 직원 {initialStaff.length}명</CardDescription>
        </div>
        <Button
          onClick={() => {
            setShowCreate((v) => !v);
            resetCreate();
          }}
          variant={showCreate ? 'outline' : 'default'}
          size="sm"
        >
          {showCreate ? '닫기' : <><Plus className="h-4 w-4" />직원 추가</>}
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {showCreate && (
          <form
            onSubmit={handleCreate}
            className="grid gap-3 rounded-md border border-dashed border-brand-400 bg-brand-50/40 p-4 dark:bg-brand-950/20 sm:grid-cols-2"
          >
            <div className="col-span-full flex items-center gap-2 text-sm font-medium">
              <UserPlus2 className="h-4 w-4" />새 직원 초대
            </div>
            <Input
              name="name"
              placeholder="이름 *"
              required
              maxLength={100}
              aria-invalid={!!errors.name}
              onBlur={(e) => onSeedChange(e.target.value)}
            />
            <div className="relative">
              <Input
                name="username"
                placeholder="로그인 ID * (영문/숫자 3~30자)"
                required
                value={username}
                onChange={(e) => onUsernameInput(e.target.value)}
                aria-invalid={!!errors.username || usernameStatus === 'taken'}
                className="pr-24 font-mono"
              />
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold">
                {usernameStatus === 'checking' && (
                  <Loader2 className="h-4 w-4 animate-spin text-slate-400 dark:text-slate-500" />
                )}
                {usernameStatus === 'ok' && (
                  <span className="inline-flex items-center gap-0.5 text-brand-600 dark:text-brand-400">
                    <Check className="h-3.5 w-3.5" />사용 가능
                  </span>
                )}
                {usernameStatus === 'taken' && (
                  <span className="text-red-600 dark:text-red-400">이미 사용 중</span>
                )}
                {usernameStatus === 'invalid' && (
                  <span className="text-red-600 dark:text-red-400">형식 오류</span>
                )}
              </span>
            </div>
            <Input name="title" placeholder="직책 (예: 프론트)" maxLength={100} />
            <span className="hidden sm:block" />
            <Input
              name="email"
              type="email"
              placeholder="이메일"
              aria-invalid={!!errors.email}
              onBlur={(e) => onSeedChange(e.target.value)}
            />
            <Input name="phone" type="tel" placeholder="연락처 (010-0000-0000)" aria-invalid={!!errors.phone} />
            <p className="col-span-full text-xs text-slate-500 dark:text-slate-400">
              · 로그인은 <b>ID 또는 이메일</b>로 가능합니다. 임시 비밀번호는 입력한 이메일·SMS로 발송됩니다.
            </p>
            {(errors.name || errors.username || errors.email || errors.phone) && (
              <p className="col-span-full text-xs text-red-600 dark:text-red-400">
                {errors.name || errors.username || errors.email || errors.phone}
              </p>
            )}
            <div className="col-span-full flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => { setShowCreate(false); resetCreate(); }}>취소</Button>
              <Button type="submit" size="sm" disabled={pending}>{pending ? '추가 중...' : '추가 + 초대 발송'}</Button>
            </div>
          </form>
        )}

        {/* 직원 리스트 — 한 사람당 한 줄, 길면 말줄임(가로 스크롤 없음). 행 클릭 → 팝업 */}
        <div className="border-t border-[#DCDEE3] dark:border-slate-700">
          <table className="w-full table-fixed text-sm">
            <thead>
              <tr className="border-b border-black/[0.06] text-sm text-[#868B94] dark:border-slate-800">
                <th className="w-[44%] px-3 py-4 text-left font-medium">이름</th>
                <th className="w-[36%] px-3 py-4 text-left font-medium">직책</th>
                <th className="w-[20%] px-3 py-4 text-left font-medium">상태</th>
              </tr>
            </thead>
            <tbody>
              {initialStaff.map((s) => {
                const isSelf = s.id === myUserId;
                return (
                  <tr
                    key={s.id}
                    onClick={isSelf ? undefined : () => setEditing(s)}
                    className={`border-b border-black/[0.06] last:border-b-0 dark:border-slate-800 ${s.isActive ? '' : 'opacity-60'} ${
                      isSelf
                        ? ''
                        : 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <td className="truncate px-3 py-6 font-medium">
                      {s.name}
                      {isSelf && (
                        <span className="ml-1 text-xs text-brand-600 dark:text-brand-400">(나)</span>
                      )}
                    </td>
                    <td className="truncate px-3 py-6 text-slate-600 dark:text-slate-300">
                      {s.title ?? '-'}
                    </td>
                    <td className="px-3 py-6">
                      {s.isActive ? (
                        <Badge tone="success">활성</Badge>
                      ) : (
                        <Badge tone="slate">비활성</Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500">
          직원을 누르면 상세 정보 조회·수정 및 활성화 여부를 변경할 수 있습니다.
        </p>
      </CardContent>

      {/* 수정 모달 */}
      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setEditing(null)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                직원 정보 수정
                {!editing.isActive && (
                  <Badge tone="slate" className="ml-2 align-middle">비활성</Badge>
                )}
              </h3>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800"
                aria-label="닫기"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleUpdate} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <Label htmlFor="edit-name">이름</Label>
                <Input id="edit-name" name="name" defaultValue={editing.name} required maxLength={100} />
              </div>
              <div className="flex flex-col gap-1">
                <Label>로그인 ID</Label>
                <Input value={editing.username ?? '-'} disabled className="font-mono text-xs" />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="edit-title">직책</Label>
                <Input id="edit-title" name="title" defaultValue={editing.title ?? ''} maxLength={100} placeholder="예: 프론트" />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="edit-email">이메일 주소</Label>
                <Input
                  id="edit-email"
                  name="email"
                  type="email"
                  defaultValue={
                    editing.email && !editing.email.endsWith('@noemail.oapms.local')
                      ? editing.email
                      : ''
                  }
                  placeholder="email@example.com"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="edit-phone">연락처</Label>
                <Input id="edit-phone" name="phone" defaultValue={editing.phone ?? ''} placeholder="010-0000-0000" />
              </div>
              {/* C1 — 비활성화/활성화 (오프보딩) */}
              <div className="mt-2 flex items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleToggleActive}
                  disabled={pending}
                  className={
                    editing.isActive
                      ? 'border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/30'
                      : ''
                  }
                >
                  {editing.isActive ? '계정 비활성화' : '계정 활성화'}
                </Button>
                <span className="flex gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(null)}>취소</Button>
                  <Button type="submit" size="sm" disabled={pending}>{pending ? '저장 중...' : '저장'}</Button>
                </span>
              </div>
            </form>
          </div>
        </div>
      )}
    </Card>
  );
}
