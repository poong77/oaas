/**
 * Tiptap FontSize 확장 — TextStyle에 fontSize 속성 추가.
 *
 * 표준 마크다운에 폰트 사이즈 문법이 없어 HTML 인라인 style로 저장됨.
 * (`<span style="font-size:18px">텍스트</span>`)
 *
 * tiptap-markdown의 html: true 옵션과 결합하여 마크다운 본문에 HTML 일부 보존.
 * 렌더링 시 rehype-raw + rehype-sanitize(style 화이트리스트)로 안전하게 표시.
 */

import { Extension } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fontSize: {
      setFontSize: (size: string) => ReturnType;
      unsetFontSize: () => ReturnType;
    };
  }
}

export const FontSize = Extension.create({
  name: 'fontSize',

  addOptions() {
    return {
      types: ['textStyle'],
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize?.replace(/['"]+/g, '') || null,
            renderHTML: (attributes) => {
              if (!attributes.fontSize) return {};
              return { style: `font-size: ${attributes.fontSize}` };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setFontSize:
        (size: string) =>
        ({ chain }) =>
          chain().setMark('textStyle', { fontSize: size }).run(),
      unsetFontSize:
        () =>
        ({ chain }) =>
          chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run(),
    };
  },
});
