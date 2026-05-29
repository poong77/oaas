/**
 * RichEditor 도구 권한 매트릭스.
 *
 * mode='full' / 'lite'에 따라 사용 가능한 기능을 명시.
 * 톨바·단축키·확장 동작 분기에 사용.
 *
 * 현재 두 모드만 운영하지만 향후 'pro' / 'minimal' 등 추가 시 본 모듈 확장.
 */

export type EditorMode = 'full' | 'lite';

export interface EditorCapabilities {
  /** 폰트 패밀리·사이즈·색상·형광펜·정렬 */
  textStyling: boolean;
  /** 표 / YouTube / HR */
  blockMedia: boolean;
  /** 코드 블록 (인라인 코드는 모두 허용) */
  codeBlock: boolean;
  /** 슬래시 커맨드 (후속 PR) */
  slashCommand: boolean;
  /** 빠른답변 패널 (Cmd+/) */
  quickReplyPanel: boolean;
  /** SMS 미리보기 토글 노출 */
  smsPreview: boolean;
}

export const FULL_CAPABILITIES: EditorCapabilities = {
  textStyling: true,
  blockMedia: true,
  codeBlock: true,
  slashCommand: false, // 후속 PR
  quickReplyPanel: true,
  smsPreview: true,
};

export const LITE_CAPABILITIES: EditorCapabilities = {
  textStyling: false,
  blockMedia: false,
  codeBlock: false,
  slashCommand: false,
  quickReplyPanel: false,
  smsPreview: false,
};

export function getEditorCapabilities(mode: EditorMode): EditorCapabilities {
  return mode === 'full' ? FULL_CAPABILITIES : LITE_CAPABILITIES;
}

export function canUseFontFamily(mode: EditorMode): boolean {
  return getEditorCapabilities(mode).textStyling;
}

export function canUseColor(mode: EditorMode): boolean {
  return getEditorCapabilities(mode).textStyling;
}

export function canUseTextAlign(mode: EditorMode): boolean {
  return getEditorCapabilities(mode).textStyling;
}

export function canUseYoutube(mode: EditorMode): boolean {
  return getEditorCapabilities(mode).blockMedia;
}

export function canUseTable(mode: EditorMode): boolean {
  return getEditorCapabilities(mode).blockMedia;
}
