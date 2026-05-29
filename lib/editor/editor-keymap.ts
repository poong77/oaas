/**
 * RichEditor 단축키 핸들러 팩토리.
 *
 * - F1 / Cmd+? / Cmd+Shift+/ → 도움말 모달
 * - Cmd+S → 자동저장 즉시 flush
 *
 * rich-editor.tsx에서 useEffect로 전역 keydown 등록.
 * 입력 필드 외부 키 무시 (editor.isFocused 체크).
 */

import type { Editor } from '@tiptap/react';

export interface EditorKeymapHandlers {
  /** F1 또는 Cmd+? → 도움말 열기 */
  onOpenHelp: () => void;
  /** Cmd+S → 자동저장 flush (자동저장 활성 시만) */
  onFlushSave?: () => void | Promise<void>;
}

export interface CreateShortcutHandlerOptions {
  editor: Editor | null;
  handlers: EditorKeymapHandlers;
}

/**
 * 전역 keydown 이벤트 핸들러 생성.
 *
 * 사용 예:
 *   useEffect(() => {
 *     const handler = createEditorShortcutHandler({ editor, handlers });
 *     window.addEventListener('keydown', handler);
 *     return () => window.removeEventListener('keydown', handler);
 *   }, [editor, handlers.onOpenHelp, handlers.onFlushSave]);
 */
export function createEditorShortcutHandler({
  editor,
  handlers,
}: CreateShortcutHandlerOptions): (e: KeyboardEvent) => void {
  return (e: KeyboardEvent) => {
    const inEditor = editor?.isFocused ?? false;

    // 도움말 — F1은 전역, Cmd+? / Cmd+Shift+/는 에디터 focus 시
    if (e.key === 'F1') {
      e.preventDefault();
      handlers.onOpenHelp();
      return;
    }
    if (
      inEditor &&
      (e.metaKey || e.ctrlKey) &&
      (e.key === '?' || (e.shiftKey && e.key === '/'))
    ) {
      e.preventDefault();
      handlers.onOpenHelp();
      return;
    }

    // Cmd+S — 자동저장 활성 + 에디터 focus 시만
    if (
      handlers.onFlushSave &&
      inEditor &&
      (e.metaKey || e.ctrlKey) &&
      e.key.toLowerCase() === 's'
    ) {
      e.preventDefault();
      void handlers.onFlushSave();
    }
  };
}
