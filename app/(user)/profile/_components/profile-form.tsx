'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { updateProfileAction } from '@/app/actions/profile-actions';

type Initial = {
  name: string;
  loginId: string;
  title: string;
  phone: string;
  email: string;
};

export function ProfileForm({ initial }: { initial: Initial }) {
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await updateProfileAction(formData);
      if (res.ok) {
        toast.success('프로필이 업데이트되었습니다');
      } else {
        if (res.fields) setErrors(res.fields);
        toast.error(res.error);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>개인 정보</CardTitle>
        <CardDescription>
          담당자 정보는 본인이 직접 수정할 수 있습니다. 권한이나 호텔 매핑
          변경은 어드민에게 요청하세요.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="이름" name="name" defaultValue={initial.name} required error={errors.name} />
          <Field
            label="로그인 ID"
            name="loginId"
            defaultValue={initial.loginId || '-'}
            disabled
            mono
            helper="로그인은 이메일 또는 ID로 가능합니다 (ID 변경 불가)"
          />
          <Field label="직책" name="title" defaultValue={initial.title} error={errors.title} placeholder="예: 프론트, 매니저" />
          <Field label="이메일" name="email" type="email" defaultValue={initial.email} error={errors.email} placeholder="email@example.com (선택)" />
          <Field label="연락처" name="phone" type="tel" defaultValue={initial.phone} placeholder="010-0000-0000" error={errors.phone} />
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

function Field({
  label,
  name,
  defaultValue,
  type = 'text',
  required,
  error,
  placeholder,
  disabled,
  helper,
  mono,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  type?: string;
  required?: boolean;
  error?: string;
  placeholder?: string;
  disabled?: boolean;
  helper?: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={name}>
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </Label>
      <Input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={!!error}
        className={`${disabled ? 'bg-slate-100 text-slate-500 dark:bg-slate-800' : ''} ${mono ? 'font-mono text-sm' : ''}`}
      />
      {helper && <p className="text-xs text-slate-400">{helper}</p>}
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
