'use client';

import { useRef, useState, useTransition } from 'react';
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
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { changePasswordAction } from '@/app/actions/profile-actions';

export function ChangePasswordForm() {
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await changePasswordAction(formData);
      if (res.ok) {
        toast.success('비밀번호가 변경되었습니다');
        formRef.current?.reset();
      } else {
        if (res.fields) setErrors(res.fields);
        toast.error(res.error);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>비밀번호 변경</CardTitle>
        <CardDescription>
          새 비밀번호는 8자 이상, 영문과 숫자를 포함해야 합니다. 변경 시 SMS
          알림이 전송됩니다.
        </CardDescription>
      </CardHeader>
      <form ref={formRef} onSubmit={handleSubmit}>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="currentPassword">현재 비밀번호 *</Label>
            <Input
              id="currentPassword"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
              aria-invalid={!!errors.currentPassword}
            />
            {errors.currentPassword && (
              <p className="text-xs text-red-600">{errors.currentPassword}</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="newPassword">새 비밀번호 *</Label>
            <Input
              id="newPassword"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              aria-invalid={!!errors.newPassword}
            />
            {errors.newPassword && (
              <p className="text-xs text-red-600">{errors.newPassword}</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="newPasswordConfirm">새 비밀번호 확인 *</Label>
            <Input
              id="newPasswordConfirm"
              name="newPasswordConfirm"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              aria-invalid={!!errors.newPasswordConfirm}
            />
            {errors.newPasswordConfirm && (
              <p className="text-xs text-red-600">{errors.newPasswordConfirm}</p>
            )}
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={pending}>
            {pending ? '변경 중...' : '비밀번호 변경'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
