'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from 'tiptap-markdown';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import Highlight from '@tiptap/extension-highlight';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Placeholder from '@tiptap/extension-placeholder';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { TextAlign } from '@tiptap/extension-text-align';
import { FontFamily } from '@tiptap/extension-font-family';
import Youtube from '@tiptap/extension-youtube';
import { FontSize } from '@/lib/editor/font-size-extension';
import { cn } from '@/lib/utils';
import { FullToolbar } from './toolbar/full-toolbar';
import { LiteToolbar } from './toolbar/lite-toolbar';
import { MobileBottomToolbar } from './toolbar/mobile-bottom-toolbar';
import { SaveIndicator } from './panels/save-indicator';
import { useAutoSave, type AutoSaveConfig } from './hooks/use-auto-save';
import { ImageUploadDialog } from './dialogs/image-upload-dialog';
import { LinkInputDialog } from './dialogs/link-input-dialog';
import { ShortcutHelpModal } from './dialogs/shortcut-help-modal';
import { DraftRestoreDialog } from './dialogs/draft-restore-dialog';

export interface RichEditorProps {
  /** 마크다운 문자열 (controlled) */
  value: string;
  /** 변경 시 호출 — 부모에서 setState */
  onChange: (markdown: string) => void;
  /** 'full' 어드민/매니저 / 'lite' 호텔리어 */
  mode?: 'full' | 'lite';
  placeholder?: string;
  minHeight?: number;
  /** 자동 저장 활성화 시 scope/targetId 전달 */
  autoSave?: AutoSaveConfig;
  disabled?: boolean;
  className?: string;
  /** 본문 영역 추가 className (prose 위에 덧붙임) */
  contentClassName?: string;
}

/**
 * 통합 RichEditor.
 *
 * - 입력: WYSIWYG (Tiptap v3)
 * - 저장: 마크다운 (tiptap-markdown)
 * - 자동 저장: localStorage + /api/drafts (autoSave prop 제공 시)
 * - 톨바: mode='full' or 'lite'
 *
 * Phase 1 골격. Phase 2~3에서 슬래시 커맨드, SMS 미리보기, 빠른답변 등 통합.
 *
 * 이미지 업로드/링크 입력 모달은 Phase 2에서 추가 (현재는 호출 핸들러 stub).
 */
export function RichEditor({
  value,
  onChange,
  mode = 'full',
  placeholder = '내용을 입력하세요...',
  minHeight = 280,
  autoSave,
  disabled = false,
  className,
  contentClassName,
}: RichEditorProps) {
  const [mounted, setMounted] = useState(false);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [draftCandidate, setDraftCandidate] = useState<{
    content: string;
    updatedAt: Date | null;
  } | null>(null);
  const restoreCheckedRef = useRef(false);
  const valueRef = useRef(value);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // codeBlock·heading·blockquote 등은 StarterKit 기본 포함
      }),
      Markdown.configure({
        html: true, // 폰트사이즈·색상·정렬 등 마크다운 외 기능을 HTML로 보존
        breaks: true,
        tightLists: true,
        linkify: true,
      }),
      Image.configure({ inline: false, allowBase64: false }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        protocols: ['http', 'https', 'mailto', 'tel'],
        HTMLAttributes: {
          rel: 'noopener noreferrer',
          target: '_blank',
        },
      }),
      Underline,
      Highlight.configure({ multicolor: true }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder, emptyEditorClass: 'is-editor-empty' }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      // 풀스택 톨바용 확장 (full 모드에서 사용)
      TextStyle,
      Color,
      FontFamily,
      FontSize,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
        alignments: ['left', 'center', 'right', 'justify'],
        defaultAlignment: 'left',
      }),
      Youtube.configure({
        controls: true,
        nocookie: true,
        modestBranding: true,
        HTMLAttributes: { class: 'editor-youtube' },
      }),
    ],
    content: value,
    editable: !disabled,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: cn('px-4 py-3 focus:outline-none', contentClassName),
      },
    },
    onUpdate: ({ editor }) => {
      const md = editor.storage.markdown.getMarkdown();
      valueRef.current = md;
      onChange(md);
    },
  });

  const autoSaveResult = useAutoSave(autoSave, value);

  // 외부에서 value가 바뀌면 에디터에 반영 (편집 도중 외부 갱신은 흔치 않음, 안전장치)
  useEffect(() => {
    if (!editor) return;
    if (!mounted) return;
    const current = editor.storage.markdown.getMarkdown() as string;
    if (current !== value) {
      // emitUpdate: false → 외부 동기화 시 onChange 재발화 방지
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [editor, value, mounted]);

  useEffect(() => {
    if (editor) setMounted(true);
  }, [editor]);

  // draft 복구 확인 — 마운트 시 1회.
  // 본문이 비어있고(or 기본 prefill만), draft가 존재하면 복구 다이얼로그.
  useEffect(() => {
    if (!autoSave || !mounted || restoreCheckedRef.current) return;
    if (autoSaveResult.draftKey === null) return;

    restoreCheckedRef.current = true;

    void (async () => {
      // 1순위: localStorage (오프라인 대비 빠름)
      const local = autoSaveResult.restoreFromLocal();
      // 2순위: 서버 draft
      const server = await autoSaveResult.fetchFromServer();

      // 비교: 서버가 최신이면 서버 사용
      const candidate = server ?? (local ? { content: local, updatedAt: null } : null);
      if (!candidate || !candidate.content.trim()) return;

      // 현재 본문(에디터)과 같으면 복구 불필요
      const currentMd = (editor?.storage.markdown.getMarkdown() as string) ?? '';
      if (currentMd.trim() === candidate.content.trim()) return;

      // 본문이 비어있거나 단순 prefill만 있는 경우에만 다이얼로그 (사용자 작업 보존 우선)
      if (currentMd.trim().length > 50) return;

      setDraftCandidate(candidate);
    })();
    // editor와 mounted만 의존 (autoSaveResult는 매 렌더마다 새 객체)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, mounted, autoSave?.scope, autoSave?.targetId]);

  // Cmd+S 핸들러 — 자동저장 활성화 시 즉시 flush
  // F1 / Cmd+? — 단축키 도움말 모달 (에디터 focus 시)
  const handleEditorShortcut = useCallback(
    (e: KeyboardEvent) => {
      const inEditor = editor?.isFocused ?? false;
      // 도움말: F1은 항상, Cmd+? 또는 Cmd+/ 는 충돌 회피 위해 에디터 focus 시
      if (e.key === 'F1') {
        e.preventDefault();
        setHelpModalOpen(true);
        return;
      }
      if (inEditor && (e.metaKey || e.ctrlKey) && (e.key === '?' || (e.shiftKey && e.key === '/'))) {
        e.preventDefault();
        setHelpModalOpen(true);
        return;
      }
      // Cmd+S — 자동저장 flush
      if (autoSave && inEditor && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void autoSaveResult.flushNow();
      }
    },
    [editor, autoSave, autoSaveResult],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleEditorShortcut);
    return () => window.removeEventListener('keydown', handleEditorShortcut);
  }, [handleEditorShortcut]);

  return (
    <div
      className={cn(
        'overflow-hidden rounded-md border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950',
        className,
      )}
      data-editor-mode={mode}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50/50 px-2 py-1 dark:border-slate-800 dark:bg-slate-900/50">
        {mode === 'full' ? (
          <FullToolbar
            editor={editor}
            onRequestImageUpload={() => setImageDialogOpen(true)}
            onRequestLinkInput={() => setLinkDialogOpen(true)}
          />
        ) : (
          <LiteToolbar
            editor={editor}
            onRequestImageUpload={() => setImageDialogOpen(true)}
            onRequestLinkInput={() => setLinkDialogOpen(true)}
          />
        )}
        {autoSave && (
          <SaveIndicator
            status={autoSaveResult.status}
            lastSavedAt={autoSaveResult.lastSavedAt}
            className="ml-auto px-2"
          />
        )}
      </div>
      <div style={{ minHeight }}>
        <EditorContent editor={editor} />
      </div>

      <ImageUploadDialog
        open={imageDialogOpen}
        onClose={() => setImageDialogOpen(false)}
        onUploaded={(url, alt) => {
          editor?.chain().focus().setImage({ src: url, alt }).run();
        }}
      />
      <LinkInputDialog
        open={linkDialogOpen}
        onClose={() => setLinkDialogOpen(false)}
        selectedText={
          editor
            ? editor.state.doc.textBetween(
                editor.state.selection.from,
                editor.state.selection.to,
                ' ',
              )
            : ''
        }
        currentHref={editor?.getAttributes('link').href ?? null}
        onApply={(href, text) => {
          if (!editor) return;
          const { from, to, empty } = editor.state.selection;
          if (empty && text) {
            // 선택 없음 + 표시 텍스트 입력 → 텍스트 삽입 후 링크 적용
            editor
              .chain()
              .focus()
              .insertContent(text)
              .setTextSelection({ from, to: from + text.length })
              .setLink({ href })
              .run();
          } else if (!empty && text && text !== editor.state.doc.textBetween(from, to, ' ')) {
            // 선택 있음 + 텍스트 변경 → 교체 후 링크
            editor
              .chain()
              .focus()
              .insertContent(text)
              .setTextSelection({ from, to: from + text.length })
              .setLink({ href })
              .run();
          } else {
            // 그냥 링크 적용
            editor.chain().focus().setLink({ href }).run();
          }
        }}
        onRemove={() => editor?.chain().focus().unsetLink().run()}
      />
      <ShortcutHelpModal
        open={helpModalOpen}
        onClose={() => setHelpModalOpen(false)}
        mode={mode}
      />
      <DraftRestoreDialog
        open={draftCandidate !== null}
        updatedAt={draftCandidate?.updatedAt ?? null}
        preview={draftCandidate?.content ?? ''}
        onRestore={() => {
          if (draftCandidate) {
            onChange(draftCandidate.content);
          }
          setDraftCandidate(null);
        }}
        onDiscard={() => {
          void autoSaveResult.clearDraft();
          setDraftCandidate(null);
        }}
        onClose={() => setDraftCandidate(null)}
      />
      {/* 모바일 sticky bottom 톨바 — lite 모드에서만 (호텔리어 중심) */}
      {mode === 'lite' && (
        <MobileBottomToolbar
          editor={editor}
          onRequestImageUpload={() => setImageDialogOpen(true)}
          onRequestLinkInput={() => setLinkDialogOpen(true)}
          onRequestHelp={() => setHelpModalOpen(true)}
        />
      )}
    </div>
  );
}
