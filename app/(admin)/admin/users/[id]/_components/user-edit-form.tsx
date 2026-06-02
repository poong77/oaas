'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useConfirmDialog } from '@/components/dialogs/confirm-dialog';
import { updateUserAdminAction } from '@/app/actions/admin-user-actions';
import { toLoginId } from '@/lib/text/login-id';
import type { UserRole } from '@/db/schema';

type Target = {
  id: string;
  name: string;
  title: string | null;
  phone: string | null;
  email: string;
  username: string | null;
  role: UserRole;
  hotelId: string | null;
};

type HotelOption = { id: string; name: string; oaPmsId: string | null };

export function UserEditForm({
  target,
  hotels,
}: {
  target: Target;
  hotels: HotelOption[];
}) {
  const confirm = useConfirmDialog();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [role, setRole] = useState<UserRole>(target.role);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    const formData = new FormData(e.currentTarget);
    const newRole = formData.get('role') as UserRole;
    if (newRole !== target.role) {
      const ok = await confirm({
        title: '권한 변경 확인',
        description: `${target.name}님의 권한이 ${roleLabel(target.role)} → ${roleLabel(newRole)}로 변경됩니다. 진행하시겠습니까?`,
        confirmText: '변경',
        tone: 'danger',
      });
      if (!ok) return;
    }
    startTransition(async () => {
      const res = await updateUserAdminAction(formData);
      if (res.ok) toast.success('편집되었습니다');
      else {
        if (res.fields) setErrors(res.fields);
        toast.error(res.error);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>계정 정보 편집</CardTitle>
        <CardDescription>이메일은 본인만 변경 가능합니다. 권한 변경 시 확인 팝업이 표시됩니다.</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <input type="hidden" name="id" value={target.id} />
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">이름 *</Label>
            <Input id="name" name="name" defaultValue={target.name} required maxLength={100} aria-invalid={!!errors.name} />
            {errors.name && <p className="text-xs text-red-600">{errors.name}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="title">직책</Label>
            <Input id="title" name="title" defaultValue={target.title ?? ''} maxLength={100} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="usernameReadonly">ID (로그인)</Label>
            <Input
              id="usernameReadonly"
              defaultValue={target.username ?? toLoginId(target.email)}
              placeholder="없음"
              disabled
            />
            <p className="text-[11px] text-slate-500">
              로그인 시 이메일 또는 이 ID를 사용합니다. (변경 불가)
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="emailReadonly">이메일 (변경 불가)</Label>
            <Input id="emailReadonly" defaultValue={target.email} disabled />
            <p className="text-[11px] text-slate-500">이메일은 본인이 자기 프로필에서만 변경 가능합니다.</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="phone">연락처</Label>
            <Input id="phone" name="phone" type="tel" defaultValue={target.phone ?? ''} aria-invalid={!!errors.phone} />
            {errors.phone && <p className="text-xs text-red-600">{errors.phone}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="role">권한 *</Label>
            <Select id="role" name="role" value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
              <option value="hotelier">호텔리어</option>
              <option value="manager">매니저</option>
              <option value="admin">어드민</option>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="hotelId">
              호텔 매핑 {role === 'hotelier' && <span className="text-red-500">*</span>}
            </Label>
            <Select id="hotelId" name="hotelId" defaultValue={target.hotelId ?? ''} aria-invalid={!!errors.hotelId}>
              <option value="">{role === 'hotelier' ? '호텔을 선택해주세요' : '미지정'}</option>
              {hotels.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name} {h.oaPmsId && `(${h.oaPmsId})`}
                </option>
              ))}
            </Select>
            {errors.hotelId && <p className="text-xs text-red-600">{errors.hotelId}</p>}
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={pending}>
            {pending ? '저장 중...' : '저장'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

function roleLabel(r: UserRole) {
  return r === 'admin' ? '어드민' : r === 'manager' ? '매니저' : '호텔리어';
}
