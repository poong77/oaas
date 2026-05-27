'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Plus, Pencil, Power, UserPlus2 } from 'lucide-react';
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
  toggleStaffActiveAction,
  updateStaffAction,
} from '@/app/actions/staff-actions';
import type { User } from '@/db/schema';

export function StaffManager({
  initialStaff,
  myUserId,
}: {
  initialStaff: User[];
  myUserId: string;
}) {
  const confirm = useConfirmDialog();
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await createStaffAction(formData);
      if (res.ok && res.data) {
        toast.success(
          `${formData.get('name')}님이 추가되었습니다. 임시비번 ${res.data.tempPassword} (이메일: ${res.data.emailSent ? '발송' : '미발송'} / SMS: ${res.data.smsSent ? '발송' : '미발송'})`,
          { duration: 10000 },
        );
        (e.target as HTMLFormElement).reset();
        setShowCreate(false);
      } else if (!res.ok) {
        if (res.fields) setErrors(res.fields);
        toast.error(res.error);
      }
    });
  }

  function handleUpdate(e: React.FormEvent<HTMLFormElement>, id: string) {
    e.preventDefault();
    setErrors({});
    const formData = new FormData(e.currentTarget);
    formData.set('id', id);
    startTransition(async () => {
      const res = await updateStaffAction(formData);
      if (res.ok) {
        toast.success('수정되었습니다');
        setEditingId(null);
      } else {
        toast.error(res.error);
      }
    });
  }

  async function handleToggle(s: User) {
    const next = !s.isActive;
    const ok = await confirm({
      title: next
        ? `${s.name}님을 다시 활성화하시겠습니까?`
        : `${s.name}님을 비활성화하시겠습니까?`,
      description: next
        ? '다시 로그인할 수 있게 됩니다.'
        : '비활성화하면 해당 계정으로 로그인할 수 없습니다. 이력은 보존됩니다.',
      tone: next ? 'default' : 'danger',
      confirmText: next ? '활성화' : '비활성화',
    });
    if (!ok) return;
    const fd = new FormData();
    fd.set('id', s.id);
    startTransition(async () => {
      const res = await toggleStaffActiveAction(fd);
      if (res.ok) toast.success('변경되었습니다');
      else toast.error(res.error);
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div>
          <CardTitle>직원 목록</CardTitle>
          <CardDescription>호텔에 등록된 직원 {initialStaff.length}명</CardDescription>
        </div>
        <Button onClick={() => setShowCreate((v) => !v)} variant={showCreate ? 'ghost' : 'default'} size="sm">
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
            <Input name="name" placeholder="이름 *" required maxLength={100} aria-invalid={!!errors.name} />
            <Input name="title" placeholder="직책 (예: 프론트)" maxLength={100} />
            <Input name="email" type="email" placeholder="이메일 *" required aria-invalid={!!errors.email} />
            <Input name="phone" type="tel" placeholder="연락처 * (010-0000-0000)" required aria-invalid={!!errors.phone} />
            {(errors.name || errors.email || errors.phone) && (
              <p className="col-span-full text-xs text-red-600">
                {errors.name || errors.email || errors.phone}
              </p>
            )}
            <div className="col-span-full flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowCreate(false)}>취소</Button>
              <Button type="submit" size="sm" disabled={pending}>{pending ? '추가 중...' : '추가 + 초대 발송'}</Button>
            </div>
          </form>
        )}

        {/* 데스크탑 테이블 */}
        <div className="hidden overflow-x-auto rounded-md border border-slate-200 dark:border-slate-800 md:block">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900/50 dark:text-slate-400">
              <tr>
                <th className="px-3 py-2 text-left">이름</th>
                <th className="px-3 py-2 text-left">직책</th>
                <th className="px-3 py-2 text-left">이메일</th>
                <th className="px-3 py-2 text-left">연락처</th>
                <th className="px-3 py-2 text-left">상태</th>
                <th className="px-3 py-2 text-right">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {initialStaff.map((s) =>
                editingId === s.id ? (
                  <tr key={s.id}>
                    <td colSpan={6} className="p-3">
                      <form onSubmit={(e) => handleUpdate(e, s.id)} className="grid gap-2 sm:grid-cols-4">
                        <Input name="name" defaultValue={s.name} required />
                        <Input name="title" defaultValue={s.title ?? ''} />
                        <Input name="phone" defaultValue={s.phone ?? ''} />
                        <div className="flex gap-1">
                          <Button type="submit" size="sm" disabled={pending}>저장</Button>
                          <Button type="button" size="sm" variant="ghost" onClick={() => setEditingId(null)}>취소</Button>
                        </div>
                      </form>
                    </td>
                  </tr>
                ) : (
                  <tr key={s.id} className={s.isActive ? '' : 'opacity-60'}>
                    <td className="px-3 py-2 font-medium">
                      {s.name}
                      {s.id === myUserId && (
                        <span className="ml-1 text-xs text-brand-600">(나)</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{s.title ?? '-'}</td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{s.email}</td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{s.phone ?? '-'}</td>
                    <td className="px-3 py-2">
                      {s.isActive ? <Badge tone="success">활성</Badge> : <Badge tone="slate">비활성</Badge>}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="inline-flex gap-1">
                        <Button type="button" size="sm" variant="ghost" onClick={() => setEditingId(s.id)} disabled={s.id === myUserId}>
                          <Pencil className="h-3.5 w-3.5" />수정
                        </Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => handleToggle(s)} disabled={s.id === myUserId}>
                          <Power className="h-3.5 w-3.5" />
                          {s.isActive ? '비활성' : '활성'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>

        {/* 모바일 카드뷰 */}
        <div className="flex flex-col gap-2 md:hidden">
          {initialStaff.map((s) => (
            <div
              key={s.id}
              className={`rounded-md border border-slate-200 p-3 dark:border-slate-800 ${s.isActive ? '' : 'opacity-60'}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold">
                    {s.name}
                    {s.id === myUserId && (
                      <span className="ml-1 text-xs text-brand-600">(나)</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500">{s.title ?? '-'}</div>
                </div>
                {s.isActive ? <Badge tone="success">활성</Badge> : <Badge tone="slate">비활성</Badge>}
              </div>
              <div className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                <div>{s.email}</div>
                <div>{s.phone ?? '-'}</div>
              </div>
              <div className="mt-2 flex gap-1">
                <Button type="button" size="sm" variant="outline" onClick={() => setEditingId(s.id)} disabled={s.id === myUserId} className="flex-1">
                  <Pencil className="h-3.5 w-3.5" />수정
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => handleToggle(s)} disabled={s.id === myUserId} className="flex-1">
                  <Power className="h-3.5 w-3.5" />
                  {s.isActive ? '비활성' : '활성'}
                </Button>
              </div>
              {editingId === s.id && (
                <form onSubmit={(e) => handleUpdate(e, s.id)} className="mt-3 grid gap-2">
                  <div>
                    <Label htmlFor={`m-name-${s.id}`}>이름</Label>
                    <Input id={`m-name-${s.id}`} name="name" defaultValue={s.name} required />
                  </div>
                  <div>
                    <Label htmlFor={`m-title-${s.id}`}>직책</Label>
                    <Input id={`m-title-${s.id}`} name="title" defaultValue={s.title ?? ''} />
                  </div>
                  <div>
                    <Label htmlFor={`m-phone-${s.id}`}>연락처</Label>
                    <Input id={`m-phone-${s.id}`} name="phone" defaultValue={s.phone ?? ''} />
                  </div>
                  <div className="flex justify-end gap-1">
                    <Button type="button" size="sm" variant="ghost" onClick={() => setEditingId(null)}>취소</Button>
                    <Button type="submit" size="sm" disabled={pending}>저장</Button>
                  </div>
                </form>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
