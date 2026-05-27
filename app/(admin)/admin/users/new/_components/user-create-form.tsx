'use client';

import { useRouter } from 'next/navigation';
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
import { createUserAdminAction } from '@/app/actions/admin-user-actions';
import type { UserRole } from '@/db/schema';

type HotelOption = { id: string; name: string; oaPmsId: string | null };

export function UserCreateForm({ hotels }: { hotels: HotelOption[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [role, setRole] = useState<UserRole>('hotelier');

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await createUserAdminAction(formData);
      if (res.ok && res.data) {
        toast.success(
          `${formData.get('name')}님이 추가되었습니다. 임시비번 ${res.data.tempPassword} (이메일: ${res.data.emailSent ? '발송' : '미발송'} / SMS: ${res.data.smsSent ? '발송' : '미발송'})`,
          { duration: 12000 },
        );
        router.push('/admin/users');
      } else if (!res.ok) {
        if (res.fields) setErrors(res.fields);
        toast.error(res.error);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>새 사용자</CardTitle>
        <CardDescription>
          호텔리어는 호텔 매핑이 필수입니다. 매니저·어드민은 호텔 매핑 없이 생성 가능합니다.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">이름 *</Label>
            <Input id="name" name="name" required maxLength={100} aria-invalid={!!errors.name} />
            {errors.name && <p className="text-xs text-red-600">{errors.name}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="title">직책</Label>
            <Input id="title" name="title" maxLength={100} placeholder="예: 프론트, 매니저" />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">이메일 *</Label>
            <Input id="email" name="email" type="email" required aria-invalid={!!errors.email} />
            {errors.email && <p className="text-xs text-red-600">{errors.email}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="phone">연락처</Label>
            <Input id="phone" name="phone" type="tel" placeholder="010-0000-0000" aria-invalid={!!errors.phone} />
            {errors.phone && <p className="text-xs text-red-600">{errors.phone}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="role">권한 *</Label>
            <Select
              id="role"
              name="role"
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              required
            >
              <option value="hotelier">호텔리어 — 본인 호텔만 접근</option>
              <option value="manager">매니저 — 콘텐츠·티켓 처리</option>
              <option value="admin">어드민 — 전체 권한</option>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="hotelId">
              호텔 매핑 {role === 'hotelier' && <span className="text-red-500">*</span>}
            </Label>
            <Select id="hotelId" name="hotelId" aria-invalid={!!errors.hotelId}>
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
        <CardFooter className="justify-between">
          <p className="text-xs text-slate-500">
            추가 시 임시 비밀번호가 자동 발급되어 SMS/이메일로 발송됩니다.
          </p>
          <Button type="submit" disabled={pending}>
            {pending ? '추가 중...' : '추가 + 초대 발송'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
