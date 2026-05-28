'use client';

import { useRouter } from 'next/navigation';
import { useTransition, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useConfirmDialog } from '@/components/dialogs/confirm-dialog';
import {
  upsertFormFieldAction,
  setFormFieldActiveAction,
} from '@/app/actions/master-actions';
import type { TicketFormField, TicketFormFieldInput } from '@/db/schema';

const INPUT_TYPES: TicketFormFieldInput[] = [
  'text',
  'textarea',
  'select',
  'number',
  'date',
  'file',
];

export function FormFieldEditor({
  item,
  productCodes,
}: {
  item?: TicketFormField;
  productCodes: string[];
}) {
  const router = useRouter();
  const confirm = useConfirmDialog();
  const [pending, startTransition] = useTransition();
  const [inputType, setInputType] = useState<TicketFormFieldInput>(
    item?.inputType ?? 'text',
  );
  const isEdit = !!item;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await upsertFormFieldAction(item?.id ?? null, undefined, fd);
      if (res.ok) {
        toast.success('저장되었습니다');
        if (!isEdit && res.id) {
          router.push(`/admin/master/form-fields/${res.id}`);
        } else {
          router.refresh();
        }
      } else {
        toast.error(res.message ?? '저장 실패');
      }
    });
  }

  async function toggleActive() {
    if (!item) return;
    const target = !item.isActive;
    const ok = await confirm({
      title: target ? '필드를 복구합니다' : '필드를 비활성화합니다',
      confirmText: target ? '복구' : '비활성화',
      tone: target ? 'default' : 'danger',
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await setFormFieldActiveAction(item.id, target);
      if (res.ok) {
        toast.success(target ? '복구되었습니다' : '비활성화되었습니다');
        router.refresh();
      } else {
        toast.error(res.message ?? '실패');
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label>제품 코드 (비우면 전체 공통)</Label>
          <Input
            name="productCode"
            defaultValue={item?.productCode ?? ''}
            list="form-field-products"
            placeholder="pms / cms / keyless / ..."
            disabled={isEdit}
          />
          <datalist id="form-field-products">
            {productCodes.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </div>
        <div className="flex flex-col gap-1">
          <Label>필드 키 (영문)</Label>
          <Input
            name="fieldKey"
            defaultValue={item?.fieldKey ?? ''}
            required
            disabled={isEdit}
            className="font-mono text-xs"
            placeholder="device_serial"
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label>라벨 (사용자 표시)</Label>
          <Input
            name="label"
            defaultValue={item?.label ?? ''}
            required
            placeholder="단말 시리얼 번호"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label>입력 타입</Label>
          <Select
            name="inputType"
            value={inputType}
            onChange={(e) =>
              setInputType(e.target.value as TicketFormFieldInput)
            }
            required
          >
            {INPUT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {inputType === 'select' && (
        <div className="flex flex-col gap-1">
          <Label>옵션 (JSON 배열)</Label>
          <Textarea
            name="optionsJson"
            defaultValue={
              item?.options ? JSON.stringify(item.options, null, 2) : ''
            }
            rows={5}
            className="font-mono text-xs"
            placeholder='[{"value":"a","label":"A"},{"value":"b","label":"B"}]'
          />
        </div>
      )}

      <div className="flex flex-col gap-1">
        <Label>도움말 (선택)</Label>
        <Input name="helpText" defaultValue={item?.helpText ?? ''} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label>정렬</Label>
          <Input
            name="sortOrder"
            type="number"
            defaultValue={item?.sortOrder ?? 100}
          />
        </div>
        <div className="flex items-center gap-2 self-end pb-1">
          <input
            type="checkbox"
            name="required"
            id="required"
            defaultChecked={item?.required ?? false}
            className="h-4 w-4"
          />
          <Label htmlFor="required" className="cursor-pointer">
            필수 필드
          </Label>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          저장
        </Button>
        {isEdit && (
          <Button
            type="button"
            variant={item!.isActive ? 'ghost' : 'outline'}
            onClick={toggleActive}
            disabled={pending}
          >
            {item!.isActive ? '비활성화' : '복구'}
          </Button>
        )}
      </div>
    </form>
  );
}
