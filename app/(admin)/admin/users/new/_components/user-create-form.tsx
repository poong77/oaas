'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import * as Dialog from '@radix-ui/react-dialog';
import { Plus, X, Building2 } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import {
  createUserAdminAction,
  quickCreateHotelAction,
} from '@/app/actions/admin-user-actions';
import type { UserRole } from '@/db/schema';

type HotelOption = { id: string; name: string; oaPmsId: string | null };

export function UserCreateForm({ hotels }: { hotels: HotelOption[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [role, setRole] = useState<UserRole>('hotelier');

  // 호텔 목록 + 선택값을 로컬 상태로 — 신규 호텔 생성 시 즉시 추가·선택
  const [hotelList, setHotelList] = useState<HotelOption[]>(hotels);
  const [hotelId, setHotelId] = useState('');
  const [hotelDialogOpen, setHotelDialogOpen] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await createUserAdminAction(formData);
      if (res.ok && res.data) {
        const invite = res.data.emailSent
          ? `임시비번 ${res.data.tempPassword} (이메일 발송${res.data.smsSent ? ' · SMS 발송' : ''})`
          : `임시비번 ${res.data.tempPassword} (${res.data.smsSent ? 'SMS 발송' : '미발송 — 아이디로 로그인'})`;
        toast.success(`${formData.get('name')}님이 추가되었습니다. ${invite}`, {
          duration: 12000,
        });
        router.push('/admin/users');
      } else if (!res.ok) {
        if (res.fields) setErrors(res.fields);
        toast.error(res.error);
      }
    });
  }

  function onHotelCreated(h: { id: string; name: string }) {
    setHotelList((prev) => [{ id: h.id, name: h.name, oaPmsId: null }, ...prev]);
    setHotelId(h.id);
    setHotelDialogOpen(false);
    setErrors((e) => ({ ...e, hotelId: '' }));
    toast.success(`호텔 "${h.name}" 생성 후 선택되었습니다`);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>새 사용자</CardTitle>
        <CardDescription>
          아이디는 필수입니다. 이메일 미입력 시 아이디로 로그인합니다. 호텔리어는
          호텔 매핑이 필수입니다.
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
            <Label htmlFor="username">아이디 *</Label>
            <Input
              id="username"
              name="username"
              required
              maxLength={100}
              autoComplete="off"
              placeholder="로그인 아이디"
              aria-invalid={!!errors.username}
            />
            {errors.username ? (
              <p className="text-xs text-red-600">{errors.username}</p>
            ) : (
              <p className="text-[11px] text-slate-500">
                영문·숫자와 . _ - @ 사용 가능. 로그인 시 이 아이디 또는 이메일 사용.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">이메일</Label>
            <Input id="email" name="email" type="email" aria-invalid={!!errors.email} />
            {errors.email ? (
              <p className="text-xs text-red-600">{errors.email}</p>
            ) : (
              <p className="text-[11px] text-slate-500">
                선택 — 입력 시 초대 메일 발송. 미입력 시 아이디로만 로그인.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="title">직책</Label>
            <Input id="title" name="title" maxLength={100} placeholder="예: 프론트, 매니저" />
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

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="hotelId">
              호텔 매핑 {role === 'hotelier' && <span className="text-red-500">*</span>}
            </Label>
            <div className="flex gap-2">
              <Select
                id="hotelId"
                name="hotelId"
                value={hotelId}
                onChange={(e) => setHotelId(e.target.value)}
                aria-invalid={!!errors.hotelId}
                className="flex-1"
              >
                <option value="">
                  {role === 'hotelier' ? '호텔을 선택해주세요' : '미지정'}
                </option>
                {hotelList.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name} {h.oaPmsId && `(${h.oaPmsId})`}
                  </option>
                ))}
              </Select>
              <Button
                type="button"
                variant="outline"
                onClick={() => setHotelDialogOpen(true)}
                className="flex-shrink-0"
              >
                <Plus className="h-4 w-4" />신규 호텔
              </Button>
            </div>
            {errors.hotelId && <p className="text-xs text-red-600">{errors.hotelId}</p>}
          </div>
        </CardContent>
        <CardFooter className="justify-between">
          <p className="text-xs text-slate-500">
            추가 시 임시 비밀번호가 자동 발급됩니다. 이메일이 있으면 초대 메일도 발송됩니다.
          </p>
          <Button type="submit" disabled={pending}>
            {pending ? '추가 중...' : '사용자 추가'}
          </Button>
        </CardFooter>
      </form>

      <NewHotelDialog
        open={hotelDialogOpen}
        onOpenChange={setHotelDialogOpen}
        onCreated={onHotelCreated}
      />
    </Card>
  );
}

// ───────── 신규 호텔 생성 팝업 ─────────

function NewHotelDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (h: { id: string; name: string }) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await quickCreateHotelAction(formData);
      if (res.ok && res.data) {
        onCreated(res.data);
      } else if (!res.ok) {
        if (res.fields) setErrors(res.fields);
        toast.error(res.error);
      }
    });
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-slate-200 bg-white p-6 shadow-xl outline-none dark:border-slate-700 dark:bg-slate-900',
            'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
          )}
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                <Building2 className="h-5 w-5" />
              </span>
              <div>
                <Dialog.Title className="text-base font-semibold text-slate-900 dark:text-slate-50">
                  신규 호텔 생성
                </Dialog.Title>
                <Dialog.Description className="text-xs text-slate-500">
                  호텔명만 입력해도 생성됩니다. 나머지는 선택 사항입니다.
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close
              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
              aria-label="닫기"
            >
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="hotel-name">호텔명 *</Label>
              <Input
                id="hotel-name"
                name="name"
                required
                maxLength={200}
                autoFocus
                placeholder="예: 한강 레지던스"
                aria-invalid={!!errors.name}
              />
              {errors.name && <p className="text-xs text-red-600">{errors.name}</p>}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="hotel-phone">연락처</Label>
                <Input id="hotel-phone" name="phone" type="tel" placeholder="02-0000-0000" aria-invalid={!!errors.phone} />
                {errors.phone && <p className="text-xs text-red-600">{errors.phone}</p>}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="hotel-manager">담당자명</Label>
                <Input id="hotel-manager" name="managerName" maxLength={100} />
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="hotel-address">주소</Label>
                <Input id="hotel-address" name="address" maxLength={500} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="hotel-bizno">사업자번호</Label>
                <Input id="hotel-bizno" name="businessNo" maxLength={30} placeholder="000-00-00000" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="hotel-pmsid">OA PMS ID</Label>
                <Input id="hotel-pmsid" name="oaPmsHotelId" maxLength={100} />
              </div>
            </div>

            <div className="mt-2 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                취소
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? '생성 중...' : '호텔 생성'}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
