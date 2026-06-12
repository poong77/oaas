'use client';

/**
 * MasterIconUpload — 마스터(제품분류 대분류·역할별 시작) 아이콘 이미지 업로드.
 *
 * - `POST /api/upload` (purpose=mastericon) 로 업로드 → 공개 프록시 URL 수신.
 * - 값은 hidden input(`name`)에 담겨 폼 제출 시 FormData 로 전송된다(언컨트롤드 폼 호환).
 * - 미리보기 + 제거 지원. 비우면 lucide 아이콘(icon 필드)로 폴백 표시된다.
 *
 * 권장 규격: 정사각형 PNG(투명배경) 128×128px 이상, 1MB 이하.
 */

import { useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { X, Upload, ImageIcon } from 'lucide-react';

const MAX_BYTES = 2 * 1024 * 1024; // 2MB (권장 1MB, 여유 한도)

export function MasterIconUpload({
  name = 'iconImageUrl',
  defaultUrl = null,
  label = '아이콘 이미지',
}: {
  name?: string;
  defaultUrl?: string | null;
  label?: string;
}) {
  const [url, setUrl] = useState<string | null>(defaultUrl);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function pick() {
    inputRef.current?.click();
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // 같은 파일 재선택 허용
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('이미지 파일만 업로드할 수 있습니다');
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error('파일이 너무 큽니다 (최대 2MB, 권장 1MB 이하)');
      return;
    }
    const fd = new FormData();
    fd.set('file', file);
    fd.set('purpose', 'mastericon');
    startTransition(async () => {
      try {
        const res = await fetch('/api/upload', { method: 'POST', body: fd });
        const json = await res.json();
        if (!res.ok || !json.ok) {
          toast.error(json.message ?? '업로드 실패');
          return;
        }
        setUrl(json.blobUrl as string);
        toast.success('아이콘 이미지를 업로드했어요');
      } catch {
        toast.error('업로드 중 오류가 발생했습니다');
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">{label}</span>
      <input type="hidden" name={name} value={url ?? ''} />
      <div className="flex items-center gap-2">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="아이콘 미리보기" className="h-full w-full object-contain" />
          ) : (
            <ImageIcon className="h-5 w-5 text-slate-400 dark:text-slate-500" />
          )}
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={pick}
              disabled={pending}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Upload className="h-3 w-3" />
              {pending ? '업로드 중…' : url ? '변경' : '업로드'}
            </button>
            {url && (
              <button
                type="button"
                onClick={() => setUrl(null)}
                disabled={pending}
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-rose-950/30"
              >
                <X className="h-3 w-3" />
                제거
              </button>
            )}
          </div>
          <span className="text-[10px] leading-tight text-slate-400 dark:text-slate-500">
            정사각형 PNG(투명배경) 128×128px↑ · 1MB 이하 권장
          </span>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
        onChange={onFile}
      />
    </div>
  );
}
