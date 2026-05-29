'use client';

/**
 * 모바일 sticky bottom 톨바.
 *
 * - 모바일(<md, 768px 미만) + 에디터 focus 시 화면 하단 fixed 노출
 * - iOS Safari visualViewport API로 가상 키보드 위치 보정
 * - lite 모드용 (호텔리어 중심) — 굵게·기울임·링크·이미지·목록·체크
 *
 * Tiptap의 BubbleMenu와는 별개. 단축키 모르는 모바일 사용자가 자주 쓰는 서식에 빠른 접근.
 */

import { useEffect, useState } from 'react';
import type { Editor } from '@tiptap/react';
import {
  Bold,
  HelpCircle,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListChecks,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface MobileBottomToolbarProps {
  editor: Editor | null;
  onRequestImageUpload: () => void;
  onRequestLinkInput: () => void;
  onRequestHelp: () => void;
}

export function MobileBottomToolbar({
  editor,
  onRequestImageUpload,
  onRequestLinkInput,
  onRequestHelp,
}: MobileBottomToolbarProps) {
  const [focused, setFocused] = useState(false);
  const [keyboardOffset, setKeyboardOffset] = useState(0);

  // 에디터 focus 추적
  useEffect(() => {
    if (!editor) return;
    const handleFocus = () => setFocused(true);
    const handleBlur = () => {
      // blur 시 약간의 딜레이 — 톨바 버튼 클릭이 blur를 먼저 발생시키지 않도록
      setTimeout(() => setFocused(false), 150);
    };
    editor.on('focus', handleFocus);
    editor.on('blur', handleBlur);
    return () => {
      editor.off('focus', handleFocus);
      editor.off('blur', handleBlur);
    };
  }, [editor]);

  // iOS Safari 가상 키보드 위치 보정 (visualViewport API)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;
    const vv = window.visualViewport;
    const updateOffset = () => {
      // 윈도우 높이 - viewport 높이 = 키보드 차지 영역
      const offset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKeyboardOffset(offset);
    };
    vv.addEventListener('resize', updateOffset);
    vv.addEventListener('scroll', updateOffset);
    updateOffset();
    return () => {
      vv.removeEventListener('resize', updateOffset);
      vv.removeEventListener('scroll', updateOffset);
    };
  }, []);

  if (!editor) return null;

  return (
    <div
      className={cn(
        'fixed left-0 right-0 z-40 flex items-center justify-around border-t border-slate-200 bg-white px-2 py-1.5 shadow-lg dark:border-slate-700 dark:bg-slate-900',
        'transition-transform duration-150 motion-reduce:transition-none',
        // 모바일에서만 노출
        'md:hidden',
        // focus 안 됐을 때 화면 밖으로 슬라이드
        !focused && 'translate-y-full',
      )}
      style={{
        bottom: keyboardOffset > 0 ? `${keyboardOffset}px` : 'env(safe-area-inset-bottom, 0px)',
      }}
      role="toolbar"
      aria-label="모바일 에디터 톨바"
      // 톨바 자체 mousedown 시 에디터 blur 방지 (포커스 유지)
      onMouseDown={(e) => e.preventDefault()}
      onTouchStart={(e) => {
        // 단, 버튼 자체 클릭은 막지 않음
        const target = e.target as HTMLElement;
        if (target.tagName !== 'BUTTON') return;
      }}
    >
      <MobileToolButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive('bold')}
        label="굵게"
      >
        <Bold className="h-4 w-4" />
      </MobileToolButton>
      <MobileToolButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive('italic')}
        label="기울임"
      >
        <Italic className="h-4 w-4" />
      </MobileToolButton>
      <MobileToolButton
        onClick={onRequestLinkInput}
        active={editor.isActive('link')}
        label="링크"
      >
        <LinkIcon className="h-4 w-4" />
      </MobileToolButton>
      <MobileToolButton onClick={onRequestImageUpload} label="이미지">
        <ImageIcon className="h-4 w-4" />
      </MobileToolButton>
      <MobileToolButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive('bulletList')}
        label="목록"
      >
        <List className="h-4 w-4" />
      </MobileToolButton>
      <MobileToolButton
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        active={editor.isActive('taskList')}
        label="체크"
      >
        <ListChecks className="h-4 w-4" />
      </MobileToolButton>
      <MobileToolButton onClick={onRequestHelp} label="도움말">
        <HelpCircle className="h-4 w-4" />
      </MobileToolButton>
    </div>
  );
}

function MobileToolButton({
  onClick,
  active = false,
  label,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        'inline-flex h-10 w-10 items-center justify-center rounded-md text-slate-700 active:bg-brand-100 dark:text-slate-200',
        active && 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300',
      )}
    >
      {children}
    </button>
  );
}
