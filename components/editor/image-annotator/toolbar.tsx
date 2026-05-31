'use client';

/**
 * 마크업 도구 툴바.
 *
 * 좌측: 도구 선택 (커서 / 화살표 / 박스 / 텍스트)
 * 가운데: 색상 (3색)
 * 우측: 프레임 / 실행취소 / 모두 지우기 / 완료
 */

import { ArrowUpRight, MousePointer2, Redo2, Square, Trash2, Type, Undo2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  type AnnotationColor,
  COLOR_HEX,
  COLOR_LABEL,
  FRAME_LABEL,
  type FrameStyle,
  type Tool,
} from './types';

interface ToolbarProps {
  tool: Tool;
  onTool: (t: Tool) => void;
  color: AnnotationColor;
  onColor: (c: AnnotationColor) => void;
  frame: FrameStyle;
  onFrame: (f: FrameStyle) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
}

export function AnnotatorToolbar({
  tool,
  onTool,
  color,
  onColor,
  frame,
  onFrame,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onClear,
}: ToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-white p-2 text-xs dark:border-slate-700 dark:bg-slate-900">
      {/* 도구 */}
      <div className="flex items-center gap-1">
        <ToolBtn active={tool === 'cursor'} onClick={() => onTool('cursor')} title="선택 (커서)">
          <MousePointer2 className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn active={tool === 'arrow'} onClick={() => onTool('arrow')} title="화살표">
          <ArrowUpRight className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn active={tool === 'rect'} onClick={() => onTool('rect')} title="박스">
          <Square className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn active={tool === 'text'} onClick={() => onTool('text')} title="텍스트 (캔버스 클릭)">
          <Type className="h-3.5 w-3.5" />
        </ToolBtn>
      </div>

      <Divider />

      {/* 색상 */}
      <div className="flex items-center gap-1">
        {(['red', 'yellow', 'blue'] as AnnotationColor[]).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onColor(c)}
            title={COLOR_LABEL[c]}
            aria-label={COLOR_LABEL[c]}
            className={cn(
              'h-6 w-6 rounded-full border-2 transition',
              color === c
                ? 'border-slate-900 dark:border-white'
                : 'border-slate-200 hover:border-slate-400 dark:border-slate-700',
            )}
            style={{ backgroundColor: COLOR_HEX[c] }}
          />
        ))}
      </div>

      <Divider />

      {/* 프레임 */}
      <div className="flex items-center gap-1">
        <ToolBtn
          active={frame === 'none'}
          onClick={() => onFrame('none')}
          title="프레임 없음"
        >
          <span className="px-1">{FRAME_LABEL.none}</span>
        </ToolBtn>
        <ToolBtn
          active={frame === 'shadow'}
          onClick={() => onFrame('shadow')}
          title="그림자 프레임"
        >
          <span className="px-1">{FRAME_LABEL.shadow}</span>
        </ToolBtn>
        <ToolBtn
          active={frame === 'browser'}
          onClick={() => onFrame('browser')}
          title="브라우저 프레임 (mac 스타일)"
        >
          <span className="px-1">{FRAME_LABEL.browser}</span>
        </ToolBtn>
      </div>

      <Divider />

      {/* 실행취소 / 지우기 */}
      <div className="ml-auto flex items-center gap-1">
        <ToolBtn onClick={onUndo} disabled={!canUndo} title="실행 취소 (Cmd/Ctrl+Z)">
          <Undo2 className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn onClick={onRedo} disabled={!canRedo} title="다시 실행 (Cmd/Ctrl+Shift+Z)">
          <Redo2 className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn onClick={onClear} title="모두 지우기">
          <Trash2 className="h-3.5 w-3.5" />
        </ToolBtn>
      </div>
    </div>
  );
}

function ToolBtn({
  active,
  onClick,
  disabled,
  title,
  children,
}: {
  active?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        // 일부 환경에서 부모 onClick 으로 이벤트가 새는 경우가 있어 명시 차단
        e.stopPropagation();
        if (onClick) onClick();
      }}
      disabled={disabled}
      title={title}
      className={cn(
        'inline-flex h-7 min-w-7 items-center justify-center rounded border-2 text-xs transition',
        active
          ? 'border-brand-600 bg-brand-100 text-brand-800 shadow-sm dark:border-brand-300 dark:bg-brand-900/60 dark:text-brand-100'
          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800',
        disabled && 'cursor-not-allowed opacity-40 hover:bg-white dark:hover:bg-slate-900',
      )}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="h-5 w-px bg-slate-200 dark:bg-slate-700" />;
}
