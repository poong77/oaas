'use client';

import type { Editor } from '@tiptap/react';
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListChecks,
  ListOrdered,
  Quote,
  Redo2,
  Strikethrough,
  Table as TableIcon,
  Underline as UnderlineIcon,
  Undo2,
} from 'lucide-react';
import { ToolbarButton, ToolbarDivider } from './toolbar-button';

interface FullToolbarProps {
  editor: Editor | null;
  onRequestImageUpload?: () => void;
  onRequestLinkInput?: () => void;
}

/**
 * 어드민·매니저용 풀 톨바.
 * 본문 폭 1040px(사이드바 펼침)에서 한 줄에 들어가도록 그룹화.
 * lg 미만은 wrap (flex-wrap), sm 이하는 lite 모드 권장.
 */
export function FullToolbar({
  editor,
  onRequestImageUpload,
  onRequestLinkInput,
}: FullToolbarProps) {
  if (!editor) return null;

  const can = editor.can();

  return (
    <div
      role="toolbar"
      aria-label="리치 에디터 톨바"
      className="flex flex-wrap items-center gap-0.5"
    >
      {/* 1) Undo/Redo */}
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

      {/* 2) Heading */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        label="제목 1"
        shortcut="Cmd+Alt+1"
        active={editor.isActive('heading', { level: 1 })}
      >
        <Heading1 className="h-4 w-4" aria-hidden />
      </ToolbarButton>
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

      {/* 3) Text style */}
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
        shortcut="Cmd+Shift+S"
        active={editor.isActive('strike')}
      >
        <Strikethrough className="h-4 w-4" aria-hidden />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHighlight().run()}
        label="형광펜"
        active={editor.isActive('highlight')}
      >
        <Highlighter className="h-4 w-4" aria-hidden />
      </ToolbarButton>
      <ToolbarDivider />

      {/* 4) Lists */}
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

      {/* 5) Blocks */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        label="인용"
        active={editor.isActive('blockquote')}
      >
        <Quote className="h-4 w-4" aria-hidden />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        label="코드 블록"
        shortcut="Cmd+Shift+C"
        active={editor.isActive('codeBlock')}
      >
        <Code className="h-4 w-4" aria-hidden />
      </ToolbarButton>
      <ToolbarDivider />

      {/* 6) Media & link */}
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
        onClick={() =>
          editor
            .chain()
            .focus()
            .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
            .run()
        }
        label="표"
      >
        <TableIcon className="h-4 w-4" aria-hidden />
      </ToolbarButton>
    </div>
  );
}
