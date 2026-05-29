'use client';

import type { Editor } from '@tiptap/react';
import { Bold, Image as ImageIcon, Italic, Link as LinkIcon, List, ListChecks } from 'lucide-react';
import { ToolbarButton, ToolbarDivider } from './toolbar-button';

interface LiteToolbarProps {
  editor: Editor | null;
  onRequestImageUpload?: () => void;
  onRequestLinkInput?: () => void;
}

/**
 * 호텔리어용 라이트 톨바 (4~5개 버튼).
 * 모바일에서도 한 줄에 들어가야 함.
 */
export function LiteToolbar({
  editor,
  onRequestImageUpload,
  onRequestLinkInput,
}: LiteToolbarProps) {
  if (!editor) return null;

  return (
    <div
      role="toolbar"
      aria-label="리치 에디터 톨바 (간단)"
      className="flex flex-wrap items-center gap-0.5"
    >
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
      <ToolbarDivider />
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
      <ToolbarDivider />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        label="글머리 목록"
        shortcut="Cmd+Shift+8"
        active={editor.isActive('bulletList')}
      >
        <List className="h-4 w-4" aria-hidden />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        label="체크리스트"
        shortcut="Cmd+Shift+9"
        active={editor.isActive('taskList')}
      >
        <ListChecks className="h-4 w-4" aria-hidden />
      </ToolbarButton>
    </div>
  );
}
