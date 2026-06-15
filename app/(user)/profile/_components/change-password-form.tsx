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
import { TextField } from '@/components/ui/text-field';
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
          <TextField
            id="currentPassword"
            name="currentPassword"
            type="password"
            label="현재 비밀번호"
            required
            autoComplete="current-password"
            error={errors.currentPassword}
          />
          <TextField
            id="newPassword"
            name="newPassword"
            type="password"
            label="새 비밀번호"
            required
            autoComplete="new-password"
            minLength={8}
            error={errors.newPassword}
          />
          <TextField
            id="newPasswordConfirm"
            name="newPasswordConfirm"
            type="password"
            label="새 비밀번호 확인"
            required
            autoComplete="new-password"
            minLength={8}
            error={errors.newPasswordConfirm}
          />
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
