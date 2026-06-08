'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Pencil } from 'lucide-react';
import { toast } from 'sonner';
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
import {
  ImageUploadDialog,
  resizeImage,
  MAX_DISPLAY_SIZE_PX,
} from './dialogs/image-upload-dialog';
import { LinkInputDialog } from './dialogs/link-input-dialog';
import { ShortcutHelpModal } from './dialogs/shortcut-help-modal';
import { DraftRestoreDialog } from './dialogs/draft-restore-dialog';
import { createEditorShortcutHandler } from '@/lib/editor/editor-keymap';
import { normalizeMarkdown } from '@/lib/editor/normalize-markdown';

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
  /** 자동 저장 상태가 변할 때마다 부모로 emit (외부 사이드바 표시바 동기용). */
  onAutosaveStatusChange?: (status: import('./panels/save-indicator').SaveStatus, lastSavedAt: number | null) => void;
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
  onAutosaveStatusChange,
  disabled = false,
  className,
  contentClassName,
}: RichEditorProps) {
  const [mounted, setMounted] = useState(false);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [helpModalOpen, setHelpModalOpen] = useState(false);

  // 본문 이미지 마우스오버 → "편집" 오버레이 버튼 표시 (재편집 기능)
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const [hoveredImg, setHoveredImg] = useState<{
    src: string;
    alt: string | null;
    x: number;
    y: number;
    width: number;
    height: number;
    node: HTMLImageElement;
  } | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  // 재편집 모드 — 다이얼로그에 initialFile 전달 + 업로드 결과를 기존 node 에 적용
  const [editingImage, setEditingImage] = useState<{
    file: File;
    node: HTMLImageElement;
    alt: string | null;
  } | null>(null);
  const [editLoading, setEditLoading] = useState(false);
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
      // Ctrl/Cmd+V 이미지 붙여넣기 → /api/upload 업로드 후 인라인 삽입.
      handlePaste: (view, event) => {
        if (disabled) return false;
        const items = event.clipboardData?.items;
        if (!items) return false;
        const imageItem = Array.from(items).find((it) =>
          it.type.startsWith('image/'),
        );
        if (!imageItem) return false;
        const file = imageItem.getAsFile();
        if (!file) return false;
        event.preventDefault();
        void (async () => {
          const tid = toast.loading('이미지 업로드 중...');
          try {
            const toSend = await resizeImage(file, MAX_DISPLAY_SIZE_PX);
            const fd = new FormData();
            fd.append('file', toSend);
            fd.append('purpose', 'editor');
            const res = await fetch('/api/upload', { method: 'POST', body: fd });
            const json = (await res.json()) as {
              ok: boolean;
              blobUrl?: string;
              message?: string;
            };
            if (!json.ok || !json.blobUrl) {
              toast.error(json.message ?? '이미지 업로드 실패', { id: tid });
              return;
            }
            const { schema } = view.state;
            const node = schema.nodes.image.create({ src: json.blobUrl });
            view.dispatch(view.state.tr.replaceSelectionWith(node));
            toast.success('이미지를 붙여넣었습니다', { id: tid });
          } catch {
            toast.error('이미지 붙여넣기에 실패했습니다', { id: tid });
          }
        })();
        return true;
      },
    },
    onUpdate: ({ editor }) => {
      // v1.1 (Option A, Design D-2): markdown + 인라인 HTML 하이브리드 저장.
      //   - tiptap-markdown의 html:true 옵션이 markdown 표현 불가능한 노드(폰트사이즈/색상/정렬/
      //     밑줄/형광펜/YouTube 등 7종)를 인라인 HTML 태그로 직렬화하여 보존.
      //   - getHTML()이 아닌 storage.markdown.getMarkdown()을 사용하면 markdown(+ 인라인 HTML)로 저장됨.
      //   - body-validator(`## H2`)는 markdown 표기 그대로이므로 정상 작동.
      //   - 회귀 검증: /admin/sandbox/editor-check 페이지에서 14종 매트릭스 시각 확인.
      // tiptap-markdown 0.9.0 라운드 트립 손상 정규화:
      //   CRLF→LF, `&gt;`→`>`, block image 다음 빈 줄 보장.
      const rawMd =
        (editor.storage.markdown?.getMarkdown() as string | undefined) ??
        editor.getHTML();
      const md = normalizeMarkdown(rawMd);
      valueRef.current = md;
      onChange(md);
    },
  });

  const autoSaveResult = useAutoSave(autoSave, value);

  // 외부에서 value가 바뀌면 에디터에 반영.
  // 주의: value는 markdown이라 editor.getHTML()로 비교하면 매번 불일치 → 매번 setContent → 커서 최하단 이동(버그).
  //       반드시 editor.storage.markdown.getMarkdown() 으로 비교해 동일하면 skip.
  useEffect(() => {
    if (!editor) return;
    if (!mounted) return;
    const rawCurrent =
      (editor.storage.markdown?.getMarkdown() as string | undefined) ??
      editor.getHTML();
    const currentMd = normalizeMarkdown(rawCurrent);
    if (currentMd === value) return;
    editor.commands.setContent(value, { emitUpdate: false });
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
      const currentMd = normalizeMarkdown(
        (editor?.storage.markdown.getMarkdown() as string) ?? '',
      );
      if (currentMd.trim() === candidate.content.trim()) return;

      // 본문이 비어있거나 단순 prefill만 있는 경우에만 다이얼로그 (사용자 작업 보존 우선)
      if (currentMd.trim().length > 50) return;

      setDraftCandidate(candidate);
    })();
    // editor와 mounted만 의존 (autoSaveResult는 매 렌더마다 새 객체)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, mounted, autoSave?.scope, autoSave?.targetId]);

  // 단축키 핸들러 — lib/editor/editor-keymap.ts에서 팩토리 임포트
  useEffect(() => {
    const handler = createEditorShortcutHandler({
      editor,
      handlers: {
        onOpenHelp: () => setHelpModalOpen(true),
        onFlushSave: autoSave ? () => autoSaveResult.flushNow() : undefined,
      },
    });
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [editor, autoSave, autoSaveResult]);

  // 외부(사이드바 등)로 자동저장 상태 emit — knowledge-base-overhaul A8
  useEffect(() => {
    if (!onAutosaveStatusChange) return;
    onAutosaveStatusChange(autoSaveResult.status, autoSaveResult.lastSavedAt);
  }, [onAutosaveStatusChange, autoSaveResult.status, autoSaveResult.lastSavedAt]);

  // ─── 본문 이미지 hover → 편집 오버레이 ───────────────────────────────
  useEffect(() => {
    const root = editorContainerRef.current;
    if (!root || disabled) return;

    function clearHideTimer() {
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    }
    function scheduleHide() {
      clearHideTimer();
      hideTimerRef.current = window.setTimeout(() => {
        setHoveredImg(null);
        hideTimerRef.current = null;
      }, 180);
    }
    function showFor(img: HTMLImageElement) {
      clearHideTimer();
      const r = img.getBoundingClientRect();
      const pr = root!.getBoundingClientRect();
      setHoveredImg({
        src: img.src,
        alt: img.getAttribute('alt') || null,
        x: r.left - pr.left,
        y: r.top - pr.top,
        width: r.width,
        height: r.height,
        node: img,
      });
    }
    function onOver(e: MouseEvent) {
      const t = e.target as HTMLElement;
      if (t && t.tagName === 'IMG' && root!.contains(t)) {
        showFor(t as HTMLImageElement);
      }
    }
    function onOut(e: MouseEvent) {
      const t = e.target as HTMLElement;
      if (t && t.tagName === 'IMG') {
        scheduleHide();
      }
    }
    function onScroll() {
      // 스크롤 중에는 오버레이 좌표가 어긋남 — hide 후 다음 hover 때 다시 계산
      setHoveredImg(null);
    }

    root.addEventListener('mouseover', onOver);
    root.addEventListener('mouseout', onOut);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      root.removeEventListener('mouseover', onOver);
      root.removeEventListener('mouseout', onOut);
      window.removeEventListener('scroll', onScroll, true);
      clearHideTimer();
    };
  }, [disabled, editor]);

  const handleEditExistingImage = useCallback(
    async (target: { src: string; alt: string | null; node: HTMLImageElement }) => {
      if (editLoading) return;
      setEditLoading(true);
      try {
        const res = await fetch(target.src);
        if (!res.ok) throw new Error(`다운로드 실패 (${res.status})`);
        const blob = await res.blob();
        const urlPath = target.src.split('?')[0]?.split('#')[0] ?? '';
        const filename =
          urlPath.split('/').pop() ||
          `image-${Date.now()}.${blob.type.split('/')[1] || 'png'}`;
        const file = new File([blob], filename, { type: blob.type || 'image/png' });

        setEditingImage({ file, node: target.node, alt: target.alt });
        setImageDialogOpen(true);
        setHoveredImg(null);
      } catch (err) {
        toast.error(
          err instanceof Error
            ? `이미지를 불러오지 못했어요: ${err.message}`
            : '이미지를 불러오지 못했어요',
        );
      } finally {
        setEditLoading(false);
      }
    },
    [editLoading],
  );

  return (
    <div
      className={cn(
        'overflow-hidden rounded-md border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950',
        className,
      )}
      data-editor-mode={mode}
    >
      {/* 상단 톨바 — 모바일에서는 숨김 (대신 bottom toolbar 노출, lite/full 모두) */}
      <div className="hidden flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50/50 px-2 py-1 md:flex dark:border-slate-800 dark:bg-slate-900/50">
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
      <div ref={editorContainerRef} className="relative" style={{ minHeight }}>
        <EditorContent editor={editor} />
        {/* 이미지 마우스오버 시 우상단에 "편집" 오버레이 버튼 */}
        {hoveredImg && !disabled && (
          <div
            className="pointer-events-none absolute z-10"
            style={{
              left: hoveredImg.x,
              top: hoveredImg.y,
              width: hoveredImg.width,
              height: hoveredImg.height,
            }}
          >
            <button
              type="button"
              onMouseEnter={() => {
                if (hideTimerRef.current !== null) {
                  window.clearTimeout(hideTimerRef.current);
                  hideTimerRef.current = null;
                }
              }}
              onMouseLeave={() => {
                if (hideTimerRef.current !== null)
                  window.clearTimeout(hideTimerRef.current);
                hideTimerRef.current = window.setTimeout(
                  () => setHoveredImg(null),
                  180,
                );
              }}
              onClick={(e) => {
                e.stopPropagation();
                void handleEditExistingImage(hoveredImg);
              }}
              disabled={editLoading}
              className="pointer-events-auto absolute right-2 top-2 inline-flex items-center gap-1 rounded-md bg-slate-900/85 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg backdrop-blur transition hover:bg-slate-900 disabled:opacity-50"
            >
              <Pencil className="h-3 w-3" />
              {editLoading ? '불러오는 중…' : '편집'}
            </button>
          </div>
        )}
      </div>

      <ImageUploadDialog
        open={imageDialogOpen}
        onClose={() => {
          setImageDialogOpen(false);
          setEditingImage(null);
        }}
        initialFile={editingImage?.file ?? null}
        initialAlt={editingImage?.alt ?? null}
        onUploaded={(url, alt) => {
          if (editingImage && editor) {
            // 기존 image 노드의 DOM 위치 → ProseMirror pos → 노드 attrs 업데이트
            try {
              const pos = editor.view.posAtDOM(editingImage.node, 0);
              if (pos >= 0) {
                editor
                  .chain()
                  .focus()
                  .command(({ tr }) => {
                    tr.setNodeMarkup(pos, undefined, { src: url, alt });
                    return true;
                  })
                  .run();
              } else {
                // 폴백: 새 노드로 삽입
                editor.chain().focus().setImage({ src: url, alt }).run();
              }
            } catch {
              editor.chain().focus().setImage({ src: url, alt }).run();
            }
            setEditingImage(null);
          } else {
            editor?.chain().focus().setImage({ src: url, alt }).run();
          }
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
      {/* 모바일 sticky bottom 톨바 — 모든 모드 (모바일 viewport에서만 노출됨) */}
      <MobileBottomToolbar
        editor={editor}
        onRequestImageUpload={() => setImageDialogOpen(true)}
        onRequestLinkInput={() => setLinkDialogOpen(true)}
        onRequestHelp={() => setHelpModalOpen(true)}
      />
    </div>
  );
}
