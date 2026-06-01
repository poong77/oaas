'use client';

/**
 * RichEditor 이미지 업로드 모달.
 *
 * 흐름:
 *   1) 파일 선택 → 단계 'select'
 *   2) 사용자가 "그냥 업로드" / "마크업 편집" 선택
 *      - 그냥 업로드: 리사이즈 → /api/upload
 *      - 마크업 편집: ImageAnnotator 로 전환 → 합성된 PNG 로 업로드
 *   3) 응답 URL을 부모(RichEditor)로 전달 → editor.commands.setImage(...)
 *
 * z-index: 60 (BubbleMenu z-50 위, ConfirmDialog/Sheet와 동등)
 */

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Loader2, Pencil, Upload, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const ImageAnnotator = dynamic(
  () => import('../image-annotator/image-annotator').then((m) => m.ImageAnnotator),
  { ssr: false, loading: () => <AnnotatorLoading /> },
);

interface ImageUploadDialogProps {
  open: boolean;
  onClose: () => void;
  /**
   * @param dimensions 서버가 sharp로 측정한 최종 px 치수(이미지 최적화된 경우만). CLS 방지에 사용.
   *                   GIF/HEIC 등 미최적화 케이스는 undefined.
   */
  onUploaded: (
    url: string,
    alt: string,
    dimensions?: { width: number; height: number },
  ) => void;
  /**
   * 기존 이미지 재편집 모드. 전달되면 file selection 단계 스킵 + 바로 annotate 진입.
   * alt 기본값으로 initialAlt 사용.
   */
  initialFile?: File | null;
  initialAlt?: string | null;
}

const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif';
const MAX_DISPLAY_SIZE_PX = 1600;

type Stage = 'select' | 'annotate';

export function ImageUploadDialog({
  open,
  onClose,
  onUploaded,
  initialFile,
  initialAlt,
}: ImageUploadDialogProps) {
  const [stage, setStage] = useState<Stage>('select');
  const [file, setFile] = useState<File | null>(null);
  const [annotatedFile, setAnnotatedFile] = useState<File | null>(null);
  const [alt, setAlt] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setStage('select');
      setFile(null);
      setAnnotatedFile(null);
      setAlt('');
      setError(null);
      return;
    }
    // open=true 이고 initialFile 이 있으면 → 바로 annotate 단계로
    if (initialFile) {
      setFile(initialFile);
      setAlt(initialAlt ?? '');
      setStage('annotate');
    }
  }, [open, initialFile, initialAlt]);

  const activeFile = annotatedFile ?? file;

  async function handleUpload() {
    if (!activeFile) return;
    setUploading(true);
    setError(null);
    try {
      const toSend = await resizeImage(activeFile, MAX_DISPLAY_SIZE_PX);
      const fd = new FormData();
      fd.append('file', toSend);
      fd.append('purpose', 'editor');
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const json = (await res.json()) as {
        ok: boolean;
        blobUrl?: string;
        message?: string;
        image?: { width?: number; height?: number };
      };
      if (!json.ok || !json.blobUrl) {
        setError(json.message ?? '업로드 실패');
        return;
      }
      const dims =
        json.image?.width && json.image?.height
          ? { width: json.image.width, height: json.image.height }
          : undefined;
      onUploaded(json.blobUrl, alt.trim() || activeFile.name, dims);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '업로드 중 오류');
    } finally {
      setUploading(false);
    }
  }

  function handleAnnotateComplete(blob: Blob) {
    const baseName = (file?.name ?? 'image').replace(/\.[^.]+$/, '');
    const out = new File([blob], `${baseName}-annotated.png`, {
      type: 'image/png',
      lastModified: Date.now(),
    });
    setAnnotatedFile(out);
    setStage('select');
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
        className={cn(
          'relative w-full rounded-md border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-900',
          stage === 'annotate' ? 'max-w-4xl' : 'max-w-md',
        )}
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

        {stage === 'select' && (
          <SelectStage
            file={file}
            annotatedFile={annotatedFile}
            alt={alt}
            uploading={uploading}
            error={error}
            inputRef={inputRef}
            onFile={(f) => {
              setFile(f);
              setAnnotatedFile(null);
            }}
            onAlt={setAlt}
            onClose={onClose}
            onUpload={handleUpload}
            onStartAnnotate={() => setStage('annotate')}
            onClearAnnotation={() => setAnnotatedFile(null)}
          />
        )}

        {stage === 'annotate' && file && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStage('select')}
                className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <ArrowLeft className="h-3 w-3" />
                업로드 화면으로
              </button>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                이미지 마크업
              </h2>
              <span className="w-20" />
            </div>
            <ImageAnnotator
              file={file}
              onComplete={handleAnnotateComplete}
              onCancel={() => setStage('select')}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function SelectStage({
  file,
  annotatedFile,
  alt,
  uploading,
  error,
  inputRef,
  onFile,
  onAlt,
  onClose,
  onUpload,
  onStartAnnotate,
  onClearAnnotation,
}: {
  file: File | null;
  annotatedFile: File | null;
  alt: string;
  uploading: boolean;
  error: string | null;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onFile: (f: File | null) => void;
  onAlt: (v: string) => void;
  onClose: () => void;
  onUpload: () => void;
  onStartAnnotate: () => void;
  onClearAnnotation: () => void;
}) {
  return (
    <>
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
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        className={cn(
          'mb-3 block w-full cursor-pointer rounded border border-dashed border-slate-300 px-3 py-6 text-center text-sm text-slate-500 hover:border-brand-400 dark:border-slate-600',
          file && 'border-brand-400 bg-brand-50/30 dark:bg-brand-950/20',
        )}
      />

      {file && (
        <>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
              📎 {(annotatedFile ?? file).name} ·{' '}
              {(((annotatedFile ?? file).size) / 1024).toFixed(0)} KB
              {annotatedFile && (
                <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                  마크업 적용됨
                </span>
              )}
            </p>
            {annotatedFile && (
              <button
                type="button"
                onClick={onClearAnnotation}
                className="text-[10px] text-slate-400 underline hover:text-slate-700"
                title="원본으로 되돌리기"
              >
                원본으로
              </button>
            )}
          </div>

          {/* 마크업 편집 진입 버튼 */}
          <button
            type="button"
            onClick={onStartAnnotate}
            className="mb-3 inline-flex w-full items-center justify-center gap-1.5 rounded border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-100 dark:border-brand-800 dark:bg-brand-950/40 dark:text-brand-200 dark:hover:bg-brand-950/60"
          >
            <Pencil className="h-3.5 w-3.5" />
            {annotatedFile ? '마크업 다시 편집' : '마크업 편집 (화살표·박스·텍스트)'}
          </button>

          <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
            대체 텍스트 (Alt, 선택)
          </label>
          <input
            type="text"
            value={alt}
            onChange={(e) => onAlt(e.target.value)}
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
          onClick={onUpload}
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
    </>
  );
}

function AnnotatorLoading() {
  return (
    <div className="flex items-center justify-center p-10 text-xs text-slate-500">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      마크업 도구를 불러오는 중...
    </div>
  );
}

/**
 * 클라이언트 canvas 리사이즈.
 * 긴 변이 maxSize 이하면 원본 그대로, 초과 시 비율 유지하며 축소. JPEG 0.85.
 * PNG 입력(마크업 결과)은 PNG 유지.
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
      // 마크업 결과(PNG)는 무손실 PNG 유지, 나머지는 JPEG로 압축
      const keepPng = file.type === 'image/png';
      const outType = keepPng ? 'image/png' : 'image/jpeg';
      const outExt = keepPng ? 'png' : 'jpg';
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(objectUrl);
          if (!blob) {
            resolve(file);
            return;
          }
          const baseName = file.name.replace(/\.[^.]+$/, '');
          const out = new File([blob], `${baseName}.${outExt}`, {
            type: outType,
            lastModified: Date.now(),
          });
          resolve(out);
        },
        outType,
        keepPng ? undefined : 0.85,
      );
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(objectUrl);
      reject(err);
    };
    img.src = objectUrl;
  });
}
