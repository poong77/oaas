'use client';

/**
 * MSG-15 — 변수 값 패널.
 *
 * 본문/제목에 변수 토큰(#{...})이 존재하면, 사용된 변수마다 값 소스를 지정한다.
 * - auto   : 연락처 자동주입 (수신자별 호텔 연락처에서 채움)
 * - manual : 직접입력 (전 수신자 공통 고정값)
 * - excel  : 엑셀 업로드 열 값
 */

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import type { VarSource } from '@/lib/messaging/format';
import type { VarBindingState } from './shared';

export const BASE_VAR_NAMES = ['업체명', '담당자명', '연락처', '호텔명'];

/** 사용된 변수명 + 사용자 오버라이드로 유효 바인딩 산출. */
export function effectiveBindings(
  names: string[],
  overrides: Record<string, { source: VarSource; value: string }>,
): VarBindingState[] {
  return names.map((name) => {
    const o = overrides[name];
    const source: VarSource = o?.source ?? (BASE_VAR_NAMES.includes(name) ? 'auto' : 'excel');
    return { name, source, value: o?.value ?? '' };
  });
}

export function VariablePanel({
  bindings,
  excelAvailable,
  onEdit,
}: {
  bindings: VarBindingState[];
  excelAvailable: boolean;
  onEdit: (name: string, patch: Partial<{ source: VarSource; value: string }>) => void;
}) {
  if (bindings.length === 0) return null;
  return (
    <div className="rounded-md border border-amber-200 bg-amber-50/40 p-3 dark:border-amber-900/60 dark:bg-amber-950/20">
      <div className="mb-2 flex items-center justify-between">
        <Label className="text-xs font-semibold text-amber-800 dark:text-amber-200">변수 값</Label>
        <span className="text-[11px] text-amber-700/80 dark:text-amber-300/80">
          본문에 사용된 변수 각각의 값 소스를 지정하세요
        </span>
      </div>
      <div className="overflow-hidden rounded-md border border-amber-200 dark:border-amber-900/60">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-amber-100/60 text-left text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              <th className="w-[28%] px-2 py-1.5 font-medium">변수</th>
              <th className="w-[34%] px-2 py-1.5 font-medium">값 소스</th>
              <th className="px-2 py-1.5 font-medium">값 / 안내</th>
            </tr>
          </thead>
          <tbody>
            {bindings.map((b) => (
              <tr key={b.name} className="border-t border-amber-200 dark:border-amber-900/60">
                <td className="px-2 py-1.5">
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
                    #{`{${b.name}}`}
                  </span>
                </td>
                <td className="px-2 py-1.5">
                  <select
                    value={b.source}
                    onChange={(e) => onEdit(b.name, { source: e.target.value as VarSource })}
                    className="h-8 w-full rounded-md border border-slate-200 bg-white px-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900"
                  >
                    <option value="auto">연락처 자동주입</option>
                    <option value="manual">직접입력</option>
                    <option value="excel">엑셀 열</option>
                  </select>
                </td>
                <td className="px-2 py-1.5">
                  {b.source === 'manual' ? (
                    <Input
                      value={b.value}
                      onChange={(e) => onEdit(b.name, { value: e.target.value })}
                      placeholder="전 수신자 공통 값"
                      className="h-8 text-xs"
                    />
                  ) : b.source === 'auto' ? (
                    <span className="text-[11px] text-slate-500">
                      {BASE_VAR_NAMES.includes(b.name)
                        ? '수신자별 호텔 연락처에서 자동 치환'
                        : '자동 치환 대상이 아닙니다 — 직접입력/엑셀 권장'}
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-500">
                      엑셀 <span className="font-mono">{b.name}</span> 열 값으로 치환
                      {!excelAvailable && <span className="text-amber-600"> · 엑셀 업로드 필요</span>}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
