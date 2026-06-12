'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, Save, Trash2 } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { updateHotelProfileAction } from '@/app/actions/hotel-actions';
import type { Hotel } from '@/db/schema';

const HOTEL_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: '선택 안 함' },
  { value: 'direct', label: '직영' },
  { value: 'operator', label: '운영사' },
  { value: 'chain', label: '체인' },
  { value: 'distributor', label: '총판' },
];

export function HotelProfileForm({ hotel }: { hotel: Hotel }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [contacts, setContacts] = useState<{ name: string; phone: string }[]>(
    () => (hotel.extraContacts ?? []) as { name: string; phone: string }[],
  );
  const [emails, setEmails] = useState<string[]>(
    () => (hotel.extraEmails ?? []) as string[],
  );

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    const fd = new FormData(e.currentTarget);
    fd.set('id', hotel.id);
    fd.set(
      'extraContactsJson',
      JSON.stringify(
        contacts.filter((c) => c.name.trim() || c.phone.trim()),
      ),
    );
    fd.set('extraEmailsJson', JSON.stringify(emails.filter((x) => x.trim())));
    startTransition(async () => {
      const res = await updateHotelProfileAction(fd);
      if (res.ok) {
        toast.success('호텔 정보가 저장되었습니다');
        router.refresh();
      } else {
        if (res.fields) setErrors(res.fields);
        toast.error(res.error);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>기본 정보</CardTitle>
        <CardDescription>
          사업자 정보 · 연락처 · 내부 메모를 한 번에 저장합니다.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {/* 호텔명 */}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="호텔명 *" error={errors.name}>
              <Input name="name" defaultValue={hotel.name} required aria-invalid={!!errors.name} />
            </Field>
          </div>

          {/* 사업자 정보 */}
          <Section title="사업자 정보">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="사업자번호" error={errors.businessNo}>
                <Input name="businessNo" defaultValue={hotel.businessNo ?? ''} placeholder="000-00-00000" />
              </Field>
              <Field label="대표명" error={errors.representativeName}>
                <Input name="representativeName" defaultValue={hotel.representativeName ?? ''} />
              </Field>
              <Field label="법인명" error={errors.corporateName}>
                <Input name="corporateName" defaultValue={hotel.corporateName ?? ''} />
              </Field>
              <Field label="타입" error={errors.hotelType}>
                <Select name="hotelType" defaultValue={hotel.hotelType ?? ''}>
                  {HOTEL_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </Select>
              </Field>
              <Field label="계약 연도" error={errors.contractYear}>
                <Input name="contractYear" type="number" min={1990} max={2100} defaultValue={hotel.contractYear ?? ''} placeholder="예: 2024" />
              </Field>
              <Field label="계약 월" error={errors.contractMonth}>
                <Input name="contractMonth" type="number" min={1} max={12} defaultValue={hotel.contractMonth ?? ''} placeholder="1~12" />
              </Field>
              <div className="sm:col-span-2">
                <Field label="주소" error={errors.address}>
                  <Input name="address" defaultValue={hotel.address ?? ''} />
                </Field>
              </div>
            </div>
          </Section>

          {/* 연락처 */}
          <Section title="연락처">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="담당자명" error={errors.managerName}>
                <Input name="managerName" defaultValue={hotel.managerName ?? ''} />
              </Field>
              <Field label="대표 연락처" error={errors.phone}>
                <Input name="phone" type="tel" defaultValue={hotel.phone ?? ''} aria-invalid={!!errors.phone} />
              </Field>
            </div>

            {/* 추가 연락처 */}
            <RepeatList
              title="추가 연락처"
              addLabel="연락처 추가"
              onAdd={() => setContacts((p) => [...p, { name: '', phone: '' }])}
              empty={contacts.length === 0}
            >
              {contacts.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={c.name}
                    onChange={(e) => setContacts((p) => p.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                    placeholder="이름"
                    className="flex-1"
                  />
                  <Input
                    value={c.phone}
                    onChange={(e) => setContacts((p) => p.map((x, j) => (j === i ? { ...x, phone: e.target.value } : x)))}
                    placeholder="연락처"
                    className="flex-1"
                  />
                  <RemoveBtn onClick={() => setContacts((p) => p.filter((_, j) => j !== i))} />
                </div>
              ))}
            </RepeatList>

            {/* 추가 이메일 */}
            <RepeatList
              title="추가 이메일"
              addLabel="이메일 추가"
              onAdd={() => setEmails((p) => [...p, ''])}
              empty={emails.length === 0}
            >
              {emails.map((em, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    type="email"
                    value={em}
                    onChange={(e) => setEmails((p) => p.map((x, j) => (j === i ? e.target.value : x)))}
                    placeholder="email@example.com"
                    className="flex-1"
                  />
                  <RemoveBtn onClick={() => setEmails((p) => p.filter((_, j) => j !== i))} />
                </div>
              ))}
            </RepeatList>
          </Section>

          {/* 내부 메모 */}
          <Section title="내부 메모">
            <Textarea name="note" defaultValue={hotel.note ?? ''} rows={3} placeholder="어드민만 볼 수 있는 메모" />
          </Section>

          <div className="flex justify-end">
            <Button type="submit" disabled={pending}>
              <Save className="h-4 w-4" />
              {pending ? '저장 중...' : '저장'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</div>
      {children}
    </div>
  );
}

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
      {hint && !error && <p className="text-xs text-slate-400">{hint}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

function RepeatList({
  title,
  addLabel,
  onAdd,
  empty,
  children,
}: {
  title: string;
  addLabel: string;
  onAdd: () => void;
  empty: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-slate-200 p-3 dark:border-slate-800">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500">{title}</span>
        <Button type="button" size="sm" variant="ghost" onClick={onAdd}>
          <Plus className="h-3.5 w-3.5" />{addLabel}
        </Button>
      </div>
      {empty ? (
        <p className="text-xs text-slate-400">등록된 항목이 없습니다.</p>
      ) : (
        <div className="flex flex-col gap-2">{children}</div>
      )}
    </div>
  );
}

function RemoveBtn({ onClick }: { onClick: () => void }) {
  return (
    <Button type="button" size="icon" variant="ghost" onClick={onClick} aria-label="삭제" className="shrink-0 text-red-500 hover:text-red-600">
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}
