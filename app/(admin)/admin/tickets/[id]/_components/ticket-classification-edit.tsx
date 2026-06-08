'use client';

/**
 * 티켓 분류(제품/유형/긴급도) 인라인 수정 — 매니저/어드민.
 * 마스터 categories 옵션과 연동. 기본은 읽기 표시, '수정'으로 셀렉트 전환.
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Pencil, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { updateTicketClassificationAction } from '@/app/actions/ticket-actions';

type Option = { code: string; label: string };

export function TicketClassificationEdit({
  ticketId,
  productCode,
  issueType,
  urgency,
  products,
  issueTypes,
  urgencies,
}: {
  ticketId: string;
  productCode: string;
  issueType: string;
  urgency: string;
  products: Option[];
  issueTypes: Option[];
  urgencies: Option[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [p, setP] = useState(productCode);
  const [t, setT] = useState(issueType);
  const [u, setU] = useState(urgency);

  const labelOf = (opts: Option[], code: string) =>
    opts.find((o) => o.code === code)?.label ?? code;

  function save() {
    const fd = new FormData();
    fd.set('ticketId', ticketId);
    fd.set('productCode', p);
    fd.set('issueType', t);
    fd.set('urgency', u);
    startTransition(async () => {
      const res = await updateTicketClassificationAction(fd);
      if (res.ok) {
        toast.success('분류를 수정했습니다');
        setEditing(false);
        router.refresh();
      } else {
        toast.error(res.message ?? '수정에 실패했습니다');
      }
    });
  }

  function cancel() {
    setP(productCode);
    setT(issueType);
    setU(urgency);
    setEditing(false);
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            분류
          </span>
          {!editing ? (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-brand-600 dark:hover:text-brand-400"
            >
              <Pencil className="h-3.5 w-3.5" />
              수정
            </button>
          ) : (
            <button
              type="button"
              onClick={cancel}
              disabled={pending}
              className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-200"
            >
              <X className="h-3.5 w-3.5" />
              취소
            </button>
          )}
        </div>

        {!editing ? (
          <div className="flex flex-wrap items-center gap-1.5 text-sm">
            <Badge tone="slate">{labelOf(products, productCode)}</Badge>
            <Badge tone="slate">{labelOf(issueTypes, issueType)}</Badge>
            <Badge tone={urgency === 'p1' ? 'danger' : 'slate'}>
              긴급도 {labelOf(urgencies, urgency)}
            </Badge>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <label className="flex flex-col gap-1 text-xs text-slate-500">
              제품
              <Select value={p} onChange={(e) => setP(e.target.value)} disabled={pending}>
                {products.map((o) => (
                  <option key={o.code} value={o.code}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-500">
              유형
              <Select value={t} onChange={(e) => setT(e.target.value)} disabled={pending}>
                {issueTypes.map((o) => (
                  <option key={o.code} value={o.code}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-500">
              긴급도
              <Select value={u} onChange={(e) => setU(e.target.value)} disabled={pending}>
                {urgencies.map((o) => (
                  <option key={o.code} value={o.code}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </label>
            <Button type="button" size="sm" onClick={save} disabled={pending} className="w-fit">
              {pending ? '저장 중...' : '저장'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
