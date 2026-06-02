'use client';

import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Pencil, Plus, Power, Search, X } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { useConfirmDialog } from '@/components/dialogs/confirm-dialog';
import {
  toggleHotelActiveAdminAction,
  upsertHotelAdminAction,
} from '@/app/actions/admin-user-actions';
import type { Hotel } from '@/db/schema';

export function HotelsManager({
  initialHotels,
  total,
  page,
  pageSize,
  initial,
}: {
  initialHotels: Hotel[];
  total: number;
  page: number;
  pageSize: number;
  initial: { q?: string; status?: string };
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const confirm = useConfirmDialog();
  const [pending, startTransition] = useTransition();
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Hotel | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [q, setQ] = useState(initial.q ?? '');

  const lastPage = Math.max(1, Math.ceil(total / pageSize));

  function go(p: number) {
    const next = new URLSearchParams(sp.toString());
    next.set('page', String(p));
    router.push(`/admin/hotels?${next.toString()}`);
  }
  function applyFilters(updates: Record<string, string | undefined>) {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v === undefined || v === '') next.delete(k);
      else next.set(k, v);
    }
    next.delete('page');
    router.push(`/admin/hotels?${next.toString()}`);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>, isEdit: boolean) {
    e.preventDefault();
    setErrors({});
    const formData = new FormData(e.currentTarget);
    if (isEdit && editing) formData.set('id', editing.id);
    startTransition(async () => {
      const res = await upsertHotelAdminAction(formData);
      if (res.ok) {
        toast.success(isEdit ? '호텔이 수정되었습니다' : '호텔이 추가되었습니다');
        setEditing(null);
        setShowCreate(false);
      } else {
        if (res.fields) setErrors(res.fields);
        toast.error(res.error);
      }
    });
  }

  async function handleToggle(h: Hotel) {
    const next = !h.isActive;
    const ok = await confirm({
      title: next ? `${h.name}을(를) 활성화하시겠습니까?` : `${h.name}을(를) 비활성화하시겠습니까?`,
      tone: next ? 'default' : 'danger',
    });
    if (!ok) return;
    const fd = new FormData();
    fd.set('id', h.id);
    startTransition(async () => {
      const res = await toggleHotelActiveAdminAction(fd);
      if (res.ok) toast.success('변경되었습니다');
      else toast.error(res.error);
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle>호텔 마스터</CardTitle>
          <CardDescription>{total}개 호텔</CardDescription>
        </div>
        <Button onClick={() => { setShowCreate((v) => !v); setEditing(null); }} size="sm">
          {showCreate ? '닫기' : <><Plus className="h-4 w-4" />호텔 추가</>}
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* 필터 */}
        <div className="grid gap-2 sm:grid-cols-3">
          <form
            onSubmit={(e) => { e.preventDefault(); applyFilters({ q }); }}
            className="relative sm:col-span-2"
          >
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="호텔명 검색 (띄어쓰기 무시)" className="pl-8 pr-8" />
            {q && (
              <button type="button" onClick={() => { setQ(''); applyFilters({ q: undefined }); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400" aria-label="지우기">
                <X className="h-4 w-4" />
              </button>
            )}
          </form>
          <Select value={initial.status ?? 'active'} onChange={(e) => applyFilters({ status: e.target.value })}>
            <option value="active">활성</option>
            <option value="inactive">비활성</option>
            <option value="all">전체</option>
          </Select>
        </div>

        {(showCreate || editing) && (
          <HotelForm
            initial={editing}
            errors={errors}
            pending={pending}
            onCancel={() => { setEditing(null); setShowCreate(false); }}
            onSubmit={(e) => handleSubmit(e, !!editing)}
          />
        )}

        {/* 테이블 */}
        <div className="hidden overflow-x-auto rounded-md border border-slate-200 dark:border-slate-800 md:block">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900/50 dark:text-slate-400">
              <tr>
                <th className="px-3 py-2 text-left">호텔명</th>
                <th className="px-3 py-2 text-left">연락처</th>
                <th className="px-3 py-2 text-left">상태</th>
                <th className="px-3 py-2 text-right">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {initialHotels.map((h) => (
                <tr key={h.id} className={h.isActive ? '' : 'opacity-60'}>
                  <td className="px-3 py-2 font-medium">{h.name}</td>
                  <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{h.phone ?? '-'}</td>
                  <td className="px-3 py-2">
                    {h.isActive ? <Badge tone="success">활성</Badge> : <Badge tone="slate">비활성</Badge>}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex gap-1">
                      <Button type="button" size="sm" variant="ghost" onClick={() => { setEditing(h); setShowCreate(false); }}>
                        <Pencil className="h-3.5 w-3.5" />수정
                      </Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => handleToggle(h)}>
                        <Power className="h-3.5 w-3.5" />
                        {h.isActive ? '비활성' : '활성'}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 모바일 카드 */}
        <div className="flex flex-col gap-2 md:hidden">
          {initialHotels.map((h) => (
            <div key={h.id} className={`rounded-md border border-slate-200 p-3 dark:border-slate-800 ${h.isActive ? '' : 'opacity-60'}`}>
              <div className="flex items-start justify-between">
                <div className="text-sm font-semibold">{h.name}</div>
                {h.isActive ? <Badge tone="success">활성</Badge> : <Badge tone="slate">비활성</Badge>}
              </div>
              <div className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                <div>전화: {h.phone ?? '-'}</div>
              </div>
              <div className="mt-2 flex gap-1">
                <Button type="button" size="sm" variant="outline" className="flex-1" onClick={() => { setEditing(h); setShowCreate(false); }}>
                  <Pencil className="h-3.5 w-3.5" />수정
                </Button>
                <Button type="button" size="sm" variant="outline" className="flex-1" onClick={() => handleToggle(h)}>
                  <Power className="h-3.5 w-3.5" />
                  {h.isActive ? '비활성' : '활성'}
                </Button>
              </div>
            </div>
          ))}
        </div>

        {lastPage > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-sm dark:border-slate-800">
            <div className="text-xs text-slate-500">
              {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} / {total}
            </div>
            <div className="flex items-center gap-1">
              <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => go(page - 1)}>
                <ChevronLeft className="h-4 w-4" />이전
              </Button>
              <span className="px-2 text-sm font-medium">{page} / {lastPage}</span>
              <Button type="button" variant="outline" size="sm" disabled={page >= lastPage} onClick={() => go(page + 1)}>
                다음<ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function HotelForm({
  initial,
  errors,
  pending,
  onCancel,
  onSubmit,
}: {
  initial: Hotel | null;
  errors: Record<string, string>;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="grid gap-3 rounded-md border border-dashed border-brand-400 bg-brand-50/30 p-4 dark:bg-brand-950/20 sm:grid-cols-2">
      <div className="col-span-full text-sm font-medium">
        {initial ? `${initial.name} 편집` : '새 호텔 추가'}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="h-name">호텔명 *</Label>
        <Input id="h-name" name="name" defaultValue={initial?.name} required aria-invalid={!!errors.name} />
        {errors.name && <p className="text-xs text-red-600">{errors.name}</p>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="h-oaPmsHotelId">OA PMS ID</Label>
        <Input id="h-oaPmsHotelId" name="oaPmsHotelId" defaultValue={initial?.oaPmsHotelId ?? ''} placeholder="HOTEL-001" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="h-managerName">담당자명</Label>
        <Input id="h-managerName" name="managerName" defaultValue={initial?.managerName ?? ''} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="h-phone">전화번호</Label>
        <Input id="h-phone" name="phone" type="tel" defaultValue={initial?.phone ?? ''} aria-invalid={!!errors.phone} />
        {errors.phone && <p className="text-xs text-red-600">{errors.phone}</p>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="h-businessNo">사업자번호</Label>
        <Input id="h-businessNo" name="businessNo" defaultValue={initial?.businessNo ?? ''} />
      </div>
      <div className="col-span-full flex flex-col gap-1.5">
        <Label htmlFor="h-address">주소</Label>
        <Input id="h-address" name="address" defaultValue={initial?.address ?? ''} />
      </div>
      <div className="col-span-full flex flex-col gap-1.5">
        <Label htmlFor="h-note">내부 메모</Label>
        <Textarea id="h-note" name="note" defaultValue={initial?.note ?? ''} rows={3} placeholder="어드민만 볼 수 있는 메모" />
      </div>
      <div className="col-span-full flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>취소</Button>
        <Button type="submit" disabled={pending}>{pending ? '저장 중...' : '저장'}</Button>
      </div>
    </form>
  );
}
