/**
 * Tiptap v3 타입 보강.
 * tiptap-markdown 패키지가 declaration merging을 자동 제공하지 않을 때 보강.
 * 본 파일은 Phase 1에서 추가되었으며, RichEditor에서 editor.storage.markdown 접근 시 사용.
 */
import '@tiptap/core';

declare module '@tiptap/core' {
  interface Storage {
    markdown: {
      getMarkdown(): string;
      options: {
        html: boolean;
        breaks: boolean;
        tightLists: boolean;
        linkify: boolean;
        transformPastedText?: boolean;
        transformCopiedText?: boolean;
      };
    };
  }
}
