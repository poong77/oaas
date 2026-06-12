'use client';

/**
 * 티켓 첨부 목록 — 이미지는 썸네일 + 클릭 시 라이트박스로 원본 표시,
 * 그 외 파일은 다운로드 링크.
 *
 * 모든 파일은 인증 프록시 `/api/attachments/[id]`로 서빙 (원본 S3는 비공개).
 *   - 미리보기/새 탭: `/api/attachments/{id}`           (inline)
 *   - 강제 다운로드 : `/api/attachments/{id}?download=1` (attachment)
 */

import { useCallback, useEffect, useState } from 'react';
import { Download, ExternalLink, Paperclip, X } from 'lucide-react';

export type AttachmentItem = {
  id: string;
  originalName: string;
  mimeType: string | null;
  sizeBytes: number;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|heic|heif|avif|bmp|svg)$/i;

function isImage(a: AttachmentItem): boolean {
  if (a.mimeType && a.mimeType.toLowerCase().startsWith('image/')) return true;
  return IMAGE_EXT.test(a.originalName);
}

function proxyUrl(id: string, download = false): string {
  return download ? `/api/attachments/${id}?download=1` : `/api/attachments/${id}`;
}

export function AttachmentList({
  attachments,
}: {
  attachments: AttachmentItem[];
}) {
  const [lightbox, setLightbox] = useState<AttachmentItem | null>(null);

  const close = useCallback(() => setLightbox(null), []);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox, close]);

  if (attachments.length === 0) return null;

  const images = attachments.filter(isImage);
  const files = attachments.filter((a) => !isImage(a));

  return (
    <>
      {/* 이미지 썸네일 그리드 */}
      {images.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {images.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setLightbox(a)}
              title={a.originalName}
              className="group relative h-28 w-28 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 transition hover:border-brand-400 dark:border-slate-700 dark:bg-slate-800"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={proxyUrl(a.id)}
                alt={a.originalName}
                loading="lazy"
                className="h-full w-full object-cover transition group-hover:scale-105"
              />
              <span className="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-black/45 px-1.5 py-0.5 text-[10px] text-white">
                {a.originalName}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* 비-이미지 파일 링크 */}
      {files.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {files.map((a) => (
            <li key={a.id}>
              <a
                href={proxyUrl(a.id)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-brand-600 hover:underline dark:text-brand-400"
              >
                <Paperclip className="h-3.5 w-3.5" />
                {a.originalName}
                <span className="text-xs text-slate-400 dark:text-slate-500">
                  ({formatBytes(a.sizeBytes)})
                </span>
                <ExternalLink className="h-3 w-3 text-slate-400 dark:text-slate-500" />
              </a>
            </li>
          ))}
        </ul>
      )}

      {/* 라이트박스 */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4"
          onClick={close}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={lightbox.originalName}
            className="relative flex max-h-[90vh] max-w-[92vw] flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={proxyUrl(lightbox.id)}
              alt={lightbox.originalName}
              className="max-h-[82vh] max-w-[92vw] rounded-lg object-contain shadow-2xl"
            />
            <div className="mt-2 flex items-center justify-between gap-3 text-white">
              <span className="truncate text-sm">
                {lightbox.originalName}
                <span className="ml-2 text-xs text-white/60">
                  ({formatBytes(lightbox.sizeBytes)})
                </span>
              </span>
              <a
                href={proxyUrl(lightbox.id, true)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-white/15 px-3 py-1.5 text-sm hover:bg-white/25"
              >
                <Download className="h-4 w-4" />
                다운로드
              </a>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label="닫기"
              className="absolute -right-2 -top-2 rounded-full bg-white p-1.5 text-slate-800 shadow-lg hover:bg-slate-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
