'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowUpRight, X } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { HotelCombobox } from '@/components/ui/hotel-combobox';
import { useConfirmDialog } from '@/components/dialogs/confirm-dialog';
import {
  addManagedHotelAction,
  removeManagedHotelAction,
} from '@/app/actions/hotel-actions';
import type { ManagedHotelView } from '@/lib/services/hotels';

export function HotelManaged({
  hotelId,
  managed,
}: {
  hotelId: string;
  managed: ManagedHotelView[];
}) {
  const router = useRouter();
  const confirm = useConfirmDialog();
  const [pending, startTransition] = useTransition();
  const [comboKey, setComboKey] = useState(0); // 선택 후 콤보박스 리셋용

  function handleAdd(linkedHotelId: string) {
    if (!linkedHotelId) return;
    if (linkedHotelId === hotelId) {
      toast.error('현재 호텔은 연결할 수 없습니다');
      setComboKey((k) => k + 1);
      return;
    }
    if (managed.some((m) => m.hotelId === linkedHotelId)) {
      toast.info('이미 연결된 호텔입니다');
      setComboKey((k) => k + 1);
      return;
    }
    const fd = new FormData();
    fd.set('hotelId', hotelId);
    fd.set('linkedHotelId', linkedHotelId);
    startTransition(async () => {
      const res = await addManagedHotelAction(fd);
      if (res.ok) {
        toast.success('멀티관리 호텔로 연결되었습니다');
        setComboKey((k) => k + 1);
        router.refresh();
      } else toast.error(res.error);
    });
  }

  async function handleRemove(m: ManagedHotelView) {
    const ok = await confirm({
      title: `'${m.name}' 연결을 해제하시겠습니까?`,
      description: '양쪽 호텔에서 멀티관리 연결이 함께 해제됩니다.',
      confirmText: '해제',
      tone: 'danger',
    });
    if (!ok) return;
    const fd = new FormData();
    fd.set('hotelId', hotelId);
    fd.set('linkedHotelId', m.hotelId);
    startTransition(async () => {
      const res = await removeManagedHotelAction(fd);
      if (res.ok) {
        toast.success('연결이 해제되었습니다');
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>멀티관리 호텔</CardTitle>
        <CardDescription>
          함께 관리하는 호텔을 연결합니다. 연결은 양쪽에 자동 반영됩니다.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="max-w-md">
          <HotelCombobox
            key={comboKey}
            placeholder="호텔명을 검색해 연결"
            onChange={(id) => handleAdd(id)}
          />
        </div>

        {managed.length === 0 ? (
          <p className="text-sm text-slate-400">연결된 호텔이 없습니다.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {managed.map((m) => (
              <li
                key={m.linkId}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 py-1 pl-3 pr-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                <Link href={`/admin/hotels/${m.hotelId}`} className="inline-flex items-center gap-1 font-medium hover:underline">
                  {m.name}
                  <ArrowUpRight className="h-3.5 w-3.5 text-slate-400" />
                </Link>
                {!m.isActive && <Badge tone="slate">비활성</Badge>}
                <button
                  type="button"
                  onClick={() => handleRemove(m)}
                  disabled={pending}
                  className="rounded-full p-0.5 text-slate-400 hover:bg-slate-200 hover:text-red-600 dark:hover:bg-slate-700"
                  aria-label={`${m.name} 연결 해제`}
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
