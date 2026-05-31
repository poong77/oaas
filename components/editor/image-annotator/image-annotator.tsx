'use client';

/**
 * 이미지 마크업 에디터 — ImageUploadDialog 안에서 사용.
 *
 * 입력: File (사용자가 선택한 원본 이미지)
 * 출력: onComplete(blob) — 마크업이 합성된 PNG Blob
 *
 * 흐름:
 *   1) File → HTMLImageElement 로 로드
 *   2) AnnotatorCanvas 에 전달, 사용자가 도형 추가
 *   3) [편집 완료] 클릭 → canvas.exportPng() → 부모로 전달
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Loader2, X } from 'lucide-react';
import { AnnotatorToolbar } from './toolbar';
import { AnnotatorCanvas, type AnnotatorCanvasHandle } from './canvas';
import {
  type AnnotationColor,
  type AnnotationShape,
  type FrameStyle,
  newId,
  type Tool,
} from './types';

interface ImageAnnotatorProps {
  file: File;
  onComplete: (blob: Blob) => void;
  onCancel: () => void;
}

interface LoadedImage {
  el: HTMLImageElement;
  width: number;
  height: number;
}

export function ImageAnnotator({ file, onComplete, onCancel }: ImageAnnotatorProps) {
  const [img, setImg] = useState<LoadedImage | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // 도구 상태
  const [tool, setTool] = useState<Tool>('arrow');
  const [color, setColor] = useState<AnnotationColor>('red');
  const [frame, setFrame] = useState<FrameStyle>('none');
  const [shapes, setShapes] = useState<AnnotationShape[]>([]);
  const [history, setHistory] = useState<AnnotationShape[][]>([[]]);
  const [historyIdx, setHistoryIdx] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // viewport 크기
  const [maxView, setMaxView] = useState({ width: 800, height: 500 });
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<AnnotatorCanvasHandle>(null);

  // viewport 측정 (반응형)
  useEffect(() => {
    if (!viewportRef.current) return;
    const el = viewportRef.current;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      setMaxView({
        width: Math.max(320, rect.width - 16),
        height: Math.max(240, Math.min(window.innerHeight * 0.6, rect.height - 16)),
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 파일 → HTMLImageElement
  useEffect(() => {
    let cancelled = false;
    const url = URL.createObjectURL(file);
    const el = new window.Image();
    // crossOrigin 은 설정하지 않음 — blob: URL 은 같은 origin 이고,
    // 일부 헤드리스 Chromium 환경에서 crossOrigin='anonymous' + blob: 조합이 로드 실패한다.
    el.onload = () => {
      if (cancelled) return;
      setImg({ el, width: el.naturalWidth, height: el.naturalHeight });
    };
    el.onerror = () => {
      // cancel 된 effect 의 잔여 onerror 는 무시
      // (React 19 Strict Mode 더블 마운트 시 첫 Image 가 revoke 된 URL 로딩 실패해도 무해)
      if (cancelled) return;
      setLoadError('이미지를 불러올 수 없어요.');
    };
    el.src = url;
    return () => {
      cancelled = true;
      // revoke 는 약간 지연 (이미 로드 시작된 image 가 안전하게 디코드 완료하도록)
      setTimeout(() => URL.revokeObjectURL(url), 100);
    };
  }, [file]);

  // shapes 변경 시 히스토리 push (직접 set 한 경우만)
  const pushHistory = useCallback((next: AnnotationShape[]) => {
    setHistory((prev) => {
      const truncated = prev.slice(0, historyIdx + 1);
      const newHist = [...truncated, next];
      // 최대 30단계
      const trimmed = newHist.length > 30 ? newHist.slice(newHist.length - 30) : newHist;
      setHistoryIdx(trimmed.length - 1);
      return trimmed;
    });
  }, [historyIdx]);

  const updateShapes = useCallback(
    (updater: AnnotationShape[] | ((prev: AnnotationShape[]) => AnnotationShape[])) => {
      setShapes((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        pushHistory(next);
        return next;
      });
    },
    [pushHistory],
  );

  const handleUndo = useCallback(() => {
    if (historyIdx <= 0) return;
    const idx = historyIdx - 1;
    setHistoryIdx(idx);
    setShapes(history[idx] ?? []);
    setSelectedId(null);
  }, [history, historyIdx]);

  const handleRedo = useCallback(() => {
    if (historyIdx >= history.length - 1) return;
    const idx = historyIdx + 1;
    setHistoryIdx(idx);
    setShapes(history[idx] ?? []);
    setSelectedId(null);
  }, [history, historyIdx]);

  const handleClear = useCallback(() => {
    if (shapes.length === 0) return;
    updateShapes([]);
    setSelectedId(null);
  }, [shapes.length, updateShapes]);

  // 키보드 단축키
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedId && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
          e.preventDefault();
          updateShapes((prev) => prev.filter((s) => s.id !== selectedId));
          setSelectedId(null);
        }
      } else if (e.key === 'Escape') {
        setSelectedId(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleUndo, handleRedo, selectedId, updateShapes]);

  // 텍스트 입력 요청
  function handleRequestText(worldX: number, worldY: number) {
    const text = window.prompt('텍스트를 입력하세요 (취소: ESC)');
    if (!text || !text.trim()) return;
    updateShapes((prev) => [
      ...prev,
      {
        id: newId(),
        type: 'text',
        x: worldX,
        y: worldY,
        text: text.trim(),
        color,
        fontSize: Math.max(16, Math.round((img?.width ?? 800) / 40)),
        hasBg: true,
      },
    ]);
  }

  async function handleExport() {
    if (!canvasRef.current) return;
    setExporting(true);
    try {
      const blob = await canvasRef.current.exportPng();
      onComplete(blob);
    } catch (err) {
      console.error('export failed', err);
      alert(`이미지 합성 실패: ${err instanceof Error ? err.message : '알 수 없는 오류'}`);
    } finally {
      setExporting(false);
    }
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center gap-3 p-6 text-center">
        <p className="text-sm text-rose-600">{loadError}</p>
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-50"
        >
          돌아가기
        </button>
      </div>
    );
  }

  if (!img) {
    return (
      <div className="flex items-center justify-center p-10 text-xs text-slate-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        이미지를 불러오는 중...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <AnnotatorToolbar
        tool={tool}
        onTool={setTool}
        color={color}
        onColor={setColor}
        frame={frame}
        onFrame={setFrame}
        canUndo={historyIdx > 0}
        canRedo={historyIdx < history.length - 1}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onClear={handleClear}
      />

      <div
        ref={viewportRef}
        className="flex min-h-[300px] items-center justify-center overflow-auto rounded-md border border-slate-200 bg-slate-100 p-2 dark:border-slate-700 dark:bg-slate-950"
      >
        <AnnotatorCanvas
          ref={canvasRef}
          image={img.el}
          width={img.width}
          height={img.height}
          maxView={maxView}
          shapes={shapes}
          onShapesChange={updateShapes}
          tool={tool}
          color={color}
          frame={frame}
          selectedId={selectedId}
          onSelectId={setSelectedId}
          onRequestText={handleRequestText}
        />
      </div>

      <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
        <span>
          {img.width} × {img.height}px
          {shapes.length > 0 && ` · 마크업 ${shapes.length}개`}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={exporting}
            className="inline-flex items-center gap-1 rounded border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            <X className="h-3 w-3" />
            취소
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="inline-flex items-center gap-1 rounded bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {exporting ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Check className="h-3 w-3" />
            )}
            편집 완료
          </button>
        </div>
      </div>
    </div>
  );
}
