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
  title: string;
  phone: string;
  email: string;
  hotelName: string;
  hotelPhone: string;
  hotelAddress: string;
  hasHotel: boolean;
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
          <Field label="직책" name="title" defaultValue={initial.title} error={errors.title} placeholder="예: 프론트, 매니저" />
          <Field label="이메일" name="email" type="email" defaultValue={initial.email} required error={errors.email} />
          <Field label="연락처" name="phone" type="tel" defaultValue={initial.phone} placeholder="010-0000-0000" error={errors.phone} />

          {initial.hasHotel && (
            <>
              <div className="col-span-full mt-2 border-t border-slate-200 pt-4 dark:border-slate-800">
                <h3 className="text-sm font-semibold">호텔 정보</h3>
                <p className="mt-1 text-xs text-slate-500">
                  호텔 기본 정보. OA PMS 매핑 ID는 어드민만 변경 가능합니다.
                </p>
              </div>
              <Field label="호텔명" name="hotelName" defaultValue={initial.hotelName} />
              <Field label="호텔 전화번호" name="hotelPhone" defaultValue={initial.hotelPhone} placeholder="02-0000-0000" />
              <div className="col-span-full">
                <Field label="주소" name="hotelAddress" defaultValue={initial.hotelAddress} />
              </div>
            </>
          )}
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
}: {
  label: string;
  name: string;
  defaultValue?: string;
  type?: string;
  required?: boolean;
  error?: string;
  placeholder?: string;
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
        aria-invalid={!!error}
      />
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
