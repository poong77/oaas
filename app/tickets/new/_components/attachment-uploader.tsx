'use client';

/**
 * 첨부 업로더 — Vercel Blob staging 업로드.
 *
 * - 다중 파일 지원 (드래그 앤 드롭 + 클릭 선택)
 * - 각 파일별 진행 상태 (uploading / done / error) 표시
 * - 부모에게 onChange(attachments[]) 콜백으로 메타 전달
 * - 50MB 제한, 한 티켓 총 200MB soft 가드
 */

import { useCallback, useId, useRef, useState } from 'react';
import {
  CheckCircle2,
  CircleAlert,
  FileText,
  Image as ImageIcon,
  Loader2,
  Paperclip,
  Trash2,
  Video,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type UploadedAttachment = {
  blobUrl: string;
  pathname: string;
  originalName: string;
  mimeType: string | null;
  sizeBytes: number;
};

type LocalFileState =
  | {
      key: string;
      file: File;
      status: 'uploading';
    }
  | {
      key: string;
      file: File;
      status: 'done';
      attachment: UploadedAttachment;
    }
  | {
      key: string;
      file: File;
      status: 'error';
      error: string;
    };

const MAX_TOTAL_SIZE = 200 * 1024 * 1024; // 200MB

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function FileIconFor({ mime, name }: { mime: string | null; name: string }) {
  const m = (mime ?? '').toLowerCase();
  if (m.startsWith('image/')) return <ImageIcon className="h-4 w-4" />;
  if (m.startsWith('video/')) return <Video className="h-4 w-4" />;
  if (name.toLowerCase().endsWith('.log')) return <FileText className="h-4 w-4" />;
  return <FileText className="h-4 w-4" />;
}

export function AttachmentUploader({
  attachments,
  onChange,
  disabled,
}: {
  attachments: UploadedAttachment[];
  onChange: (next: UploadedAttachment[]) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const [items, setItems] = useState<LocalFileState[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const upload = useCallback(
    async (file: File) => {
      const key = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setItems((prev) => [...prev, { key, file, status: 'uploading' }]);
      const fd = new FormData();
      fd.append('file', file);
      fd.append('purpose', 'ticket');
      try {
        const res = await fetch('/api/upload', { method: 'POST', body: fd });
        const json = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          message?: string;
          blobUrl?: string;
          pathname?: string;
          originalName?: string;
          mimeType?: string | null;
          sizeBytes?: number;
        };
        if (!res.ok || !json.ok) {
          throw new Error(json.message ?? `업로드 실패 (${res.status})`);
        }
        const attachment: UploadedAttachment = {
          blobUrl: json.blobUrl!,
          pathname: json.pathname!,
          originalName: json.originalName ?? file.name,
          mimeType: json.mimeType ?? file.type ?? null,
          sizeBytes: json.sizeBytes ?? file.size,
        };
        setItems((prev) =>
          prev.map((it) =>
            it.key === key ? { ...it, status: 'done', attachment } : it,
          ),
        );
        onChange([...attachments, attachment]);
      } catch (err) {
        const msg = err instanceof Error ? err.message : '업로드 실패';
        setItems((prev) =>
          prev.map((it) =>
            it.key === key ? { ...it, status: 'error', error: msg } : it,
          ),
        );
      }
    },
    [attachments, onChange],
  );

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      const arr = Array.from(files);
      const currentSize = attachments.reduce((s, a) => s + a.sizeBytes, 0);
      let runningSize = currentSize;
      for (const f of arr) {
        runningSize += f.size;
        if (runningSize > MAX_TOTAL_SIZE) {
          setItems((prev) => [
            ...prev,
            {
              key: `${Date.now()}-${f.name}`,
              file: f,
              status: 'error',
              error: '총 첨부 용량이 200MB를 초과합니다',
            },
          ]);
          continue;
        }
        void upload(f);
      }
    },
    [attachments, upload],
  );

  const removeItem = (key: string) => {
    const target = items.find((it) => it.key === key);
    if (target && target.status === 'done') {
      onChange(
        attachments.filter((a) => a.pathname !== target.attachment.pathname),
      );
    }
    setItems((prev) => prev.filter((it) => it.key !== key));
  };

  const totalSize = attachments.reduce((s, a) => s + a.sizeBytes, 0);
  const totalSizePct = Math.min(100, Math.round((totalSize / MAX_TOTAL_SIZE) * 100));

  return (
    <div className="flex flex-col gap-3">
      <label
        htmlFor={inputId}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (disabled) return;
          if (e.dataTransfer?.files?.length) handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors',
          dragOver
            ? 'border-brand-400 bg-brand-50/60 dark:border-brand-600 dark:bg-brand-950/30'
            : 'border-slate-300 bg-slate-50/50 hover:border-brand-300 hover:bg-brand-50/30 dark:border-slate-700 dark:bg-slate-900/40 dark:hover:border-brand-700 dark:hover:bg-brand-950/20',
          disabled && 'cursor-not-allowed opacity-60',
        )}
      >
        <Paperclip className="h-6 w-6 text-slate-400" />
        <div className="text-sm font-medium text-slate-700 dark:text-slate-200">
          파일을 끌어 놓거나 클릭하여 선택
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400">
          이미지·비디오·PDF·ZIP·로그 (개당 최대 50MB, 총 200MB)
        </div>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          multiple
          className="hidden"
          disabled={disabled}
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </label>

      {/* 누적 사용량 바 */}
      {(items.length > 0 || attachments.length > 0) && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>
              {attachments.length}개 · {formatBytes(totalSize)} /{' '}
              {formatBytes(MAX_TOTAL_SIZE)}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
            <div
              className="h-full bg-brand-500 transition-all"
              style={{ width: `${totalSizePct}%` }}
            />
          </div>
        </div>
      )}

      {/* 항목 리스트 */}
      {items.length > 0 && (
        <ul className="flex flex-col gap-2">
          {items.map((it) => (
            <li
              key={it.key}
              className="flex items-center gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <div className="text-slate-400">
                <FileIconFor mime={it.file.type} name={it.file.name} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{it.file.name}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {formatBytes(it.file.size)}
                  {it.status === 'error' && (
                    <span className="ml-2 text-red-500">— {it.error}</span>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {it.status === 'uploading' && (
                  <Loader2 className="h-4 w-4 animate-spin text-brand-500" />
                )}
                {it.status === 'done' && (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                )}
                {it.status === 'error' && (
                  <CircleAlert className="h-4 w-4 text-red-500" />
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeItem(it.key)}
                  aria-label="삭제"
                >
                  <Trash2 className="h-4 w-4 text-slate-400" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
