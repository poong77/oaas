'use client';

import { useState } from 'react';
import type { Editor } from '@tiptap/react';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Code,
  Code2,
  Heading2,
  Heading3,
  Highlighter,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Palette,
  Play,
  Quote,
  Redo2,
  Strikethrough,
  Table as TableIcon,
  Underline as UnderlineIcon,
  Undo2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ToolbarButton, ToolbarDivider } from './toolbar-button';

interface FullToolbarProps {
  editor: Editor | null;
  onRequestImageUpload?: () => void;
  onRequestLinkInput?: () => void;
}

const FONT_FAMILIES: Array<{ label: string; value: string }> = [
  { label: '기본체', value: '' },
  { label: '고딕', value: 'system-ui, -apple-system, "Apple SD Gothic Neo", sans-serif' },
  { label: '명조', value: '"Noto Serif KR", "Times New Roman", serif' },
  { label: '코드', value: 'ui-monospace, SFMono-Regular, Menlo, monospace' },
];

const FONT_SIZES = ['12', '14', '16', '18', '20', '24', '32'];

const TEXT_COLORS = [
  '#0f172a', // slate-900 (기본/검정)
  '#64748b', // slate-500 (회색)
  '#dc2626', // red-600
  '#ea580c', // orange-600
  '#ca8a04', // yellow-600
  '#16a34a', // green-600
  '#2563eb', // blue-600
  '#7c3aed', // violet-600
];

const HIGHLIGHT_COLORS = [
  '#fef08a', // yellow-200
  '#bbf7d0', // green-200
  '#bfdbfe', // blue-200
  '#fecaca', // red-200
];

/**
 * 풀스택 톨바 — 어드민·매니저용.
 * 본문 폭 1040px에서 flex-wrap으로 줄바꿈 가능.
 *
 * 행 1: Undo/Redo · 폰트 · 사이즈 · H2 H3 · B I U S · 색상 · 형광펜 · 정렬 4 · 목록 3 · 인용
 * 행 2: 인라인 코드 · HR · 링크 · 이미지 · YouTube · 표 · 코드블록
 */
export function FullToolbar({
  editor,
  onRequestImageUpload,
  onRequestLinkInput,
}: FullToolbarProps) {
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [highlightPickerOpen, setHighlightPickerOpen] = useState(false);

  if (!editor) return null;
  const can = editor.can();

  const currentFontSize =
    (editor.getAttributes('textStyle')?.fontSize as string | undefined)?.replace('px', '') ?? '';
  const currentFontFamily = (editor.getAttributes('textStyle')?.fontFamily as string | undefined) ?? '';
  const currentColor = (editor.getAttributes('textStyle')?.color as string | undefined) ?? '';

  return (
    <div
      role="toolbar"
      aria-label="리치 에디터 톨바"
      className="flex flex-wrap items-center gap-0.5"
    >
      {/* Undo/Redo */}
      <ToolbarButton
        onClick={() => editor.chain().focus().undo().run()}
        label="실행취소"
        shortcut="Cmd+Z"
        disabled={!can.undo()}
      >
        <Undo2 className="h-4 w-4" aria-hidden />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().redo().run()}
        label="재실행"
        shortcut="Cmd+Shift+Z"
        disabled={!can.redo()}
      >
        <Redo2 className="h-4 w-4" aria-hidden />
      </ToolbarButton>
      <ToolbarDivider />

      {/* 폰트 패밀리 */}
      <select
        aria-label="폰트"
        value={currentFontFamily}
        onChange={(e) => {
          const v = e.target.value;
          if (v) editor.chain().focus().setFontFamily(v).run();
          else editor.chain().focus().unsetFontFamily().run();
        }}
        className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 hover:border-brand-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
      >
        {FONT_FAMILIES.map((f) => (
          <option key={f.label} value={f.value}>
            {f.label}
          </option>
        ))}
      </select>

      {/* 폰트 사이즈 */}
      <select
        aria-label="폰트 사이즈"
        value={currentFontSize || '16'}
        onChange={(e) => {
          editor.chain().focus().setFontSize(`${e.target.value}px`).run();
        }}
        className="h-8 w-16 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 hover:border-brand-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
      >
        {FONT_SIZES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <ToolbarDivider />

      {/* Heading */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        label="제목 2"
        shortcut="Cmd+Alt+2"
        active={editor.isActive('heading', { level: 2 })}
      >
        <Heading2 className="h-4 w-4" aria-hidden />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        label="제목 3"
        shortcut="Cmd+Alt+3"
        active={editor.isActive('heading', { level: 3 })}
      >
        <Heading3 className="h-4 w-4" aria-hidden />
      </ToolbarButton>
      <ToolbarDivider />

      {/* Text style */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        label="굵게"
        shortcut="Cmd+B"
        active={editor.isActive('bold')}
      >
        <Bold className="h-4 w-4" aria-hidden />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        label="기울임"
        shortcut="Cmd+I"
        active={editor.isActive('italic')}
      >
        <Italic className="h-4 w-4" aria-hidden />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        label="밑줄"
        shortcut="Cmd+U"
        active={editor.isActive('underline')}
      >
        <UnderlineIcon className="h-4 w-4" aria-hidden />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        label="취소선"
        active={editor.isActive('strike')}
      >
        <Strikethrough className="h-4 w-4" aria-hidden />
      </ToolbarButton>
      <ToolbarDivider />

      {/* 텍스트 색상 popup */}
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setColorPickerOpen((v) => !v);
            setHighlightPickerOpen(false);
          }}
          aria-label="텍스트 색상"
          title="텍스트 색상"
          className={cn(
            'inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-600 hover:bg-brand-100 hover:text-brand-700 dark:text-slate-300 dark:hover:bg-brand-900/30',
            colorPickerOpen && 'bg-brand-100 dark:bg-brand-900/30',
          )}
          style={currentColor ? { color: currentColor } : undefined}
        >
          <Palette className="h-4 w-4" aria-hidden />
          <span className="sr-only">텍스트 색상</span>
        </button>
        {colorPickerOpen && (
          <div className="absolute left-0 top-full z-50 mt-1 flex flex-wrap gap-1 rounded-md border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-900">
            {TEXT_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => {
                  editor.chain().focus().setColor(color).run();
                  setColorPickerOpen(false);
                }}
                aria-label={`색상 ${color}`}
                className="h-6 w-6 rounded border border-slate-300 hover:scale-110 dark:border-slate-600"
                style={{ background: color }}
              />
            ))}
            <button
              type="button"
              onClick={() => {
                editor.chain().focus().unsetColor().run();
                setColorPickerOpen(false);
              }}
              className="ml-1 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400"
            >
              초기화
            </button>
          </div>
        )}
      </div>

      {/* 형광펜 popup */}
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setHighlightPickerOpen((v) => !v);
            setColorPickerOpen(false);
          }}
          aria-label="형광펜"
          title="형광펜"
          className={cn(
            'inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-600 hover:bg-brand-100 hover:text-brand-700 dark:text-slate-300 dark:hover:bg-brand-900/30',
            (highlightPickerOpen || editor.isActive('highlight')) &&
              'bg-brand-100 text-brand-700 dark:bg-brand-900/30',
          )}
        >
          <Highlighter className="h-4 w-4" aria-hidden />
        </button>
        {highlightPickerOpen && (
          <div className="absolute left-0 top-full z-50 mt-1 flex flex-wrap gap-1 rounded-md border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-900">
            {HIGHLIGHT_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => {
                  editor.chain().focus().toggleHighlight({ color }).run();
                  setHighlightPickerOpen(false);
                }}
                aria-label={`형광펜 ${color}`}
                className="h-6 w-6 rounded border border-slate-300 hover:scale-110 dark:border-slate-600"
                style={{ background: color }}
              />
            ))}
            <button
              type="button"
              onClick={() => {
                editor.chain().focus().unsetHighlight().run();
                setHighlightPickerOpen(false);
              }}
              className="ml-1 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400"
            >
              초기화
            </button>
          </div>
        )}
      </div>
      <ToolbarDivider />

      {/* 정렬 4 */}
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
        label="왼쪽 정렬"
        active={editor.isActive({ textAlign: 'left' })}
      >
        <AlignLeft className="h-4 w-4" aria-hidden />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
        label="가운데 정렬"
        active={editor.isActive({ textAlign: 'center' })}
      >
        <AlignCenter className="h-4 w-4" aria-hidden />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
        label="오른쪽 정렬"
        active={editor.isActive({ textAlign: 'right' })}
      >
        <AlignRight className="h-4 w-4" aria-hidden />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('justify').run()}
        label="양쪽 정렬"
        active={editor.isActive({ textAlign: 'justify' })}
      >
        <AlignJustify className="h-4 w-4" aria-hidden />
      </ToolbarButton>
      <ToolbarDivider />

      {/* Lists */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        label="글머리 목록"
        shortcut="Cmd+Shift+8"
        active={editor.isActive('bulletList')}
      >
        <List className="h-4 w-4" aria-hidden />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        label="번호 목록"
        shortcut="Cmd+Shift+7"
        active={editor.isActive('orderedList')}
      >
        <ListOrdered className="h-4 w-4" aria-hidden />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        label="체크리스트"
        shortcut="Cmd+Shift+9"
        active={editor.isActive('taskList')}
      >
        <ListChecks className="h-4 w-4" aria-hidden />
      </ToolbarButton>
      <ToolbarDivider />

      {/* 인라인 코드 · 인용 · HR · 링크 · 이미지 · YouTube · 표 · 코드블록 */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCode().run()}
        label="인라인 코드"
        shortcut="Cmd+E"
        active={editor.isActive('code')}
      >
        <Code className="h-4 w-4" aria-hidden />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        label="인용"
        active={editor.isActive('blockquote')}
      >
        <Quote className="h-4 w-4" aria-hidden />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        label="구분선"
      >
        <Minus className="h-4 w-4" aria-hidden />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => onRequestLinkInput?.()}
        label="링크"
        shortcut="Cmd+K"
        active={editor.isActive('link')}
        disabled={!onRequestLinkInput}
      >
        <LinkIcon className="h-4 w-4" aria-hidden />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => onRequestImageUpload?.()}
        label="이미지"
        disabled={!onRequestImageUpload}
      >
        <ImageIcon className="h-4 w-4" aria-hidden />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => {
          const url = window.prompt('YouTube URL을 입력하세요 (예: https://youtu.be/...)');
          if (url) {
            editor.chain().focus().setYoutubeVideo({ src: url, width: 640, height: 360 }).run();
          }
        }}
        label="YouTube 비디오"
      >
        <Play className="h-4 w-4" aria-hidden />
      </ToolbarButton>
      <ToolbarButton
        onClick={() =>
          editor
            .chain()
            .focus()
            .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
            .run()
        }
        label="표 삽입"
      >
        <TableIcon className="h-4 w-4" aria-hidden />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        label="코드 블록"
        shortcut="Cmd+Shift+C"
        active={editor.isActive('codeBlock')}
      >
        <Code2 className="h-4 w-4" aria-hidden />
      </ToolbarButton>
    </div>
  );
}
