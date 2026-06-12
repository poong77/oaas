'use client';

/**
 * 메뉴 접근 제어 토글 리스트 (어드민 only).
 *
 * 각 토글 대상 마스터 메뉴에 대해 매니저 접근 ON/OFF 스위치를 표시.
 * 낙관적 UI: 스위치 즉시 반영 → 서버 실패 시 롤백 + 토스트.
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { setMasterMenuAccessAction } from '@/app/actions/master-actions';
import type { MasterMenuMeta } from '@/lib/services/master-meta';

type Props = {
  menus: readonly MasterMenuMeta[];
  /** 메뉴키 → 매니저 접근 허용 여부 (초기값) */
  initialAccess: Record<string, boolean>;
};

export function MenuAccessList({ menus, initialAccess }: Props) {
  const router = useRouter();
  const [access, setAccess] = useState<Record<string, boolean>>(initialAccess);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function onToggle(menu: MasterMenuMeta, next: boolean) {
    const prev = access[menu.key] ?? true;
    // 낙관적 반영
    setAccess((m) => ({ ...m, [menu.key]: next }));
    setPendingKey(menu.key);

    startTransition(async () => {
      const res = await setMasterMenuAccessAction(menu.key, next);
      setPendingKey(null);
      if (res.ok) {
        toast.success(
          next
            ? `‘${menu.label}’ 매니저 접근을 허용했습니다`
            : `‘${menu.label}’ 매니저 접근을 차단했습니다`,
        );
        router.refresh();
      } else {
        // 롤백
        setAccess((m) => ({ ...m, [menu.key]: prev }));
        toast.error(res.message ?? '변경에 실패했습니다');
      }
    });
  }

  return (
    <ul className="divide-y divide-slate-100 dark:divide-slate-800">
      {menus.map((menu) => {
        const allowed = access[menu.key] ?? true;
        return (
          <li
            key={menu.key}
            className="flex items-center justify-between gap-3 px-4 py-3.5"
          >
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {menu.label}
              </span>
              <code className="font-mono text-[11px] text-slate-400 dark:text-slate-500">
                /admin/master/{menu.key}
              </code>
            </div>
            <div className="flex shrink-0 items-center gap-2.5">
              <Badge tone={allowed ? 'success' : 'slate'}>
                {allowed ? '매니저 허용' : '어드민 전용'}
              </Badge>
              <Switch
                checked={allowed}
                disabled={pendingKey === menu.key}
                onCheckedChange={(next) => onToggle(menu, next)}
                aria-label={`${menu.label} 매니저 접근`}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
