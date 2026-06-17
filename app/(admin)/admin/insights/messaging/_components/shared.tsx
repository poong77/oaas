'use client';

/**
 * 메일&문자 발송 — 공용 타입·헬퍼·소형 UI.
 *
 * MSG-15 변수 모델, MSG-16 템플릿, MSG-17 엑셀, MSG-18 호텔리어 전체에서 공유.
 */

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Check, Clipboard, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import type { SendRecipient, MessageBatchItem } from '@/app/actions/messaging-actions';
import type { VarSource } from '@/lib/messaging/format';

export type Tab = 'mail' | 'sms' | 'template' | 'messagebox';
export type HotelHit = { id: string; name: string };

/** 수신자 주소 → 변수/업체명 매핑. 호텔검색·엑셀·호텔리어 전체 공용. */
export type RecipientMeta = {
  /** 추가된 호텔/업체명 (복수 가능). 첫 항목이 대표 업체명. */
  hotels: string[];
  person?: string | null;
  phone?: string | null;
  /** 엑셀 업로드 행의 커스텀 변수값 (변수명 → 값). */
  excel?: Record<string, string>;
};
export type MetaMap = Record<string, RecipientMeta>;

/** 변수 값 바인딩(폼 상태) — 변수명별 소스 + 직접입력값. */
export type VarBindingState = { name: string; source: VarSource; value: string };

/** 채널 탭에 템플릿을 적용할 때 전달하는 시드. */
export type TemplateSeed = {
  channel: 'email' | 'sms';
  subject: string;
  body: string;
  fromName?: string | null;
  fromLocal?: string | null;
  variables: Array<{ name: string; source: VarSource }>;
};

export function parseRecipients(raw: string): string[] {
  return [
    ...new Set(
      raw
        .split(/[\n,;]+/)
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];
}

/** 주소+메타 → 구조화 수신자(업체명 표시 + auto/excel 변수값). */
export function buildSendRecipients(addresses: string[], meta: MetaMap): SendRecipient[] {
  return addresses.map((address) => {
    const m = meta[address];
    if (!m || (m.hotels.length === 0 && !m.excel)) {
      return { address, company: null };
    }
    const first = m.hotels[0] ?? null;
    const extra = Math.max(0, m.hotels.length - 1);
    const company = first ? (extra > 0 ? `${first}(+${extra})` : first) : null;
    return {
      address,
      company,
      auto: {
        업체명: first ?? '',
        호텔명: first ?? '',
        담당자명: m.person ?? '',
        연락처: m.phone ?? '',
      },
      excel: m.excel,
    };
  });
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fallthrough */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function formatDateTimeSec(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** 메시지함 유형 배지. */
export function typeBadge(item: MessageBatchItem) {
  if (item.channel === 'email') return <Badge tone="brand">메일</Badge>;
  const tone = item.msgType === 'lms' ? 'warn' : item.msgType === 'mms' ? 'success' : 'slate';
  return <Badge tone={tone as 'warn' | 'success' | 'slate'}>문자 {item.msgType.toUpperCase()}</Badge>;
}

/** 수신 요약: "그랜드호텔 외 2 · N명". */
export function recipientSummary(item: MessageBatchItem): string {
  const cos = item.companies ?? [];
  if (cos.length === 0) return `${item.total}명`;
  if (cos.length === 1) return `${cos[0]} · ${item.total}명`;
  return `${cos[0]} 외 ${cos.length - 1} · ${item.total}명`;
}

export function WarningBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

export function ReasonInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-xs">발송 사유 (이력 기록용)</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="예: 정기 점검 안내, 장애 공지"
        className="h-9"
      />
    </div>
  );
}

/** 본문 라벨 옆 변수 칩 — 클릭 시 onInsert(token). 커스텀 변수칩도 표시. */
export function VariableChips({
  onInsert,
  customNames = [],
}: {
  onInsert: (token: string) => void;
  customNames?: string[];
}) {
  const base = ['업체명', '담당자명', '연락처', '호텔명'];
  const all = [...base, ...customNames.filter((n) => !base.includes(n))];
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[11px] text-slate-400">변수 삽입</span>
      {all.map((name) => (
        <button
          key={name}
          type="button"
          onClick={() => onInsert(`#{${name}}`)}
          title={`#{${name}} 삽입`}
          className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 transition hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
        >
          + {name}
        </button>
      ))}
    </div>
  );
}

export function CopyButton({ label, text, disabled }: { label: string; text: string; disabled?: boolean }) {
  const [copied, setCopied] = useState(false);
  async function onClick() {
    const ok = await copyText(text);
    if (!ok) {
      toast.error('복사에 실패했습니다');
      return;
    }
    setCopied(true);
    toast.success(`${label} 복사됨`);
    window.setTimeout(() => setCopied(false), 1500);
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-brand-950/30 dark:hover:text-brand-300"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Clipboard className="h-3.5 w-3.5" />}
      {label}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────
// 청크 분할 발송 + 진행률 (대량 발송 시 Vercel 타임아웃 회피 + 진행 표시)
// ─────────────────────────────────────────────────────────────────────

export type SendProgress = { total: number; done: number; sent: number; failed: number };

/** 수신자를 chunkSize씩 나눠 순차 발송하며 진행률 콜백. 같은 batchId로 묶음 유지. */
export async function runChunkedSend<T>(opts: {
  items: T[];
  batchId: string;
  chunkSize?: number;
  send: (chunk: T[], batchId: string) => Promise<{ ok: boolean; sent?: number; failed?: number; message?: string }>;
  onProgress: (p: SendProgress) => void;
}): Promise<{ sent: number; failed: number; errors: number; firstError?: string }> {
  const { items, batchId, chunkSize = 20, send, onProgress } = opts;
  let sent = 0;
  let failed = 0;
  let errors = 0;
  let done = 0;
  let firstError: string | undefined;
  onProgress({ total: items.length, done, sent, failed });
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    try {
      const res = await send(chunk, batchId);
      if (res.ok) {
        sent += res.sent ?? 0;
        failed += res.failed ?? 0;
      } else {
        errors += chunk.length;
        if (!firstError) firstError = res.message;
      }
    } catch {
      errors += chunk.length;
      if (!firstError) firstError = '발송 중 오류';
    }
    done += chunk.length;
    onProgress({ total: items.length, done, sent, failed });
  }
  return { sent, failed, errors, firstError };
}

/** 발송 진행률 모달 — 진행 중에는 닫기 불가, 완료 시 결과 + 닫기. */
export function SendProgressModal({
  title,
  progress,
  finished,
  errors = 0,
  onClose,
}: {
  title: string;
  progress: SendProgress;
  finished: boolean;
  errors?: number;
  onClose: () => void;
}) {
  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative z-10 w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
        <h3 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</h3>

        <div className="mb-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>{finished ? '완료' : '발송 중…'}</span>
          <span>
            {progress.done} / {progress.total} ({pct}%)
          </span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className={`h-full rounded-full transition-[width] duration-300 ${finished ? 'bg-brand-600' : 'bg-brand-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <span className="text-emerald-600 dark:text-emerald-400">성공 {progress.sent}</span>
          <span className="text-rose-600 dark:text-rose-400">실패 {progress.failed}</span>
          {errors > 0 && <span className="text-amber-600 dark:text-amber-400">오류 {errors}</span>}
        </div>

        {finished ? (
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
            >
              닫기
            </button>
          </div>
        ) : (
          <p className="mt-3 text-[11px] text-slate-400">
            대량 발송은 나눠서 처리됩니다. 이 창을 닫지 말고 잠시 기다려 주세요.
          </p>
        )}
      </div>
    </div>
  );
}

export function Modal({
  title,
  onClose,
  children,
  size = 'lg',
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  size?: 'sm' | 'lg' | 'xl';
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  const max = size === 'sm' ? 'max-w-md' : size === 'xl' ? 'max-w-2xl' : 'max-w-lg';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className={
          'relative z-10 flex max-h-[88vh] w-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900 ' +
          max
        }
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-auto p-4">{children}</div>
      </div>
    </div>
  );
}
