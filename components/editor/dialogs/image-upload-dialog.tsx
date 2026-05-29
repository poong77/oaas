'use client';

/**
 * RichEditor 이미지 업로드 모달.
 *
 * - 파일 선택 → 클라이언트 canvas 리사이즈 (최대 1600px) → /api/upload (purpose='editor')
 * - 응답 URL을 부모(RichEditor)로 전달 → editor.commands.setImage(...)
 * - Alt 텍스트 입력 (접근성·검색·이메일 fallback)
 *
 * z-index: 60 (BubbleMenu z-50 위, ConfirmDialog/Sheet와 동등)
 */

import { useEffect, useRef, useState } from 'react';
import { Loader2, Upload, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImageUploadDialogProps {
  open: boolean;
  onClose: () => void;
  onUploaded: (url: string, alt: string) => void;
}

const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif';
const MAX_DISPLAY_SIZE_PX = 1600;

export function ImageUploadDialog({ open, onClose, onUploaded }: ImageUploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [alt, setAlt] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setFile(null);
      setAlt('');
      setError(null);
    }
  }, [open]);

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const toSend = await resizeImage(file, MAX_DISPLAY_SIZE_PX);
      const fd = new FormData();
      fd.append('file', toSend);
      fd.append('purpose', 'editor');
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const json = (await res.json()) as {
        ok: boolean;
        blobUrl?: string;
        message?: string;
      };
      if (!json.ok || !json.blobUrl) {
        setError(json.message ?? '업로드 실패');
        return;
      }
      onUploaded(json.blobUrl, alt.trim() || file.name);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '업로드 중 오류');
    } finally {
      setUploading(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="이미지 업로드"
        className="relative w-full max-w-md rounded-md border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="absolute right-3 top-3 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
        >
          <X className="h-4 w-4" />
        </button>
        <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100">
          이미지 업로드
        </h2>
        <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
          jpg / png / webp / gif / heic, 최대 10MB. 1600px 초과 시 자동 리사이즈.
        </p>

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className={cn(
            'mb-3 block w-full cursor-pointer rounded border border-dashed border-slate-300 px-3 py-6 text-center text-sm text-slate-500 hover:border-brand-400 dark:border-slate-600',
            file && 'border-brand-400 bg-brand-50/30 dark:bg-brand-950/20',
          )}
        />

        {file && (
          <>
            <p className="mb-2 truncate text-xs text-slate-500 dark:text-slate-400">
              📎 {file.name} · {(file.size / 1024).toFixed(0)} KB
            </p>
            <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
              대체 텍스트 (Alt, 선택)
            </label>
            <input
              type="text"
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
              placeholder="이미지 설명 (접근성·이메일 fallback에 사용)"
              className="mb-3 block w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-sm focus:border-brand-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </>
        )}

        {error && (
          <p className="mb-2 rounded border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            className="rounded px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleUpload}
            disabled={!file || uploading}
            className="inline-flex items-center gap-1.5 rounded bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-brand-700"
          >
            {uploading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                업로드 중...
              </>
            ) : (
              <>
                <Upload className="h-3.5 w-3.5" />
                업로드
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * 클라이언트 canvas 리사이즈.
 * 긴 변이 maxSize 이하면 원본 그대로, 초과 시 비율 유지하며 축소. JPEG 0.85.
 */
async function resizeImage(file: File, maxSize: number): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  if (file.type === 'image/gif') return file; // 애니메이션 보존

  return new Promise<File>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      const { width, height } = img;
      let nw = width;
      let nh = height;
      if (Math.max(width, height) > maxSize) {
        if (width >= height) {
          nw = maxSize;
          nh = Math.round((height * maxSize) / width);
        } else {
          nh = maxSize;
          nw = Math.round((width * maxSize) / height);
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = nw;
      canvas.height = nh;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(objectUrl);
        resolve(file);
        return;
      }
      ctx.drawImage(img, 0, 0, nw, nh);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(objectUrl);
          if (!blob) {
            resolve(file);
            return;
          }
          const baseName = file.name.replace(/\.[^.]+$/, '');
          const out = new File([blob], `${baseName}.jpg`, {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });
          resolve(out);
        },
        'image/jpeg',
        0.85,
      );
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(objectUrl);
      reject(err);
    };
    img.src = objectUrl;
  });
}
