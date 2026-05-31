/**
 * 이미지 마크업 도구 타입 정의.
 *
 * MVP 도구: 화살표 / 사각형 / 텍스트 + 단순 그림자 프레임.
 * 모든 좌표는 원본 이미지 기준 (스테이지는 화면 크기에 맞춰 scale).
 */

export type AnnotationColor = 'red' | 'yellow' | 'blue';

export const COLOR_HEX: Record<AnnotationColor, string> = {
  red: '#ef4444',
  yellow: '#facc15',
  blue: '#3b82f6',
};

export const COLOR_LABEL: Record<AnnotationColor, string> = {
  red: '빨강',
  yellow: '노랑',
  blue: '파랑',
};

export type Tool = 'cursor' | 'arrow' | 'rect' | 'text';

export interface ArrowShape {
  id: string;
  type: 'arrow';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: AnnotationColor;
  strokeWidth: number;
}

export interface RectShape {
  id: string;
  type: 'rect';
  x: number;
  y: number;
  width: number;
  height: number;
  color: AnnotationColor;
  strokeWidth: number;
}

export interface TextShape {
  id: string;
  type: 'text';
  x: number;
  y: number;
  text: string;
  color: AnnotationColor;
  fontSize: number;
  hasBg: boolean;
}

export type AnnotationShape = ArrowShape | RectShape | TextShape;

export type FrameStyle = 'none' | 'shadow' | 'browser' | 'iphone' | 'macbook';

/** FrameStyle 별 표시 라벨. */
export const FRAME_LABEL: Record<FrameStyle, string> = {
  none: '없음',
  shadow: '그림자',
  browser: '브라우저',
  iphone: 'iPhone',
  macbook: 'MacBook',
};

/** 프레임 뒤 배경 그라데이션 프리셋. */
export type BgColor = 'slate' | 'sky' | 'sunset' | 'mint' | 'lavender' | 'sand';

/** [stop0, stop1] — 좌상단→우하단 선형 그라데이션 색상 쌍. */
export const BG_GRADIENTS: Record<BgColor, [string, string]> = {
  slate: ['#f1f5f9', '#e2e8f0'],
  sky: ['#bae6fd', '#a5f3fc'],
  sunset: ['#fed7aa', '#fbcfe8'],
  mint: ['#bbf7d0', '#a5f3fc'],
  lavender: ['#ddd6fe', '#fbcfe8'],
  sand: ['#fef3c7', '#fed7aa'],
};

export const BG_LABEL: Record<BgColor, string> = {
  slate: '회색',
  sky: '하늘',
  sunset: '노을',
  mint: '민트',
  lavender: '라벤더',
  sand: '모래',
};

/** 툴바 swatch 표시용 CSS gradient string. */
export function bgSwatchCss(c: BgColor): string {
  const [a, b] = BG_GRADIENTS[c];
  return `linear-gradient(135deg, ${a}, ${b})`;
}

export interface AnnotatorState {
  shapes: AnnotationShape[];
  frame: FrameStyle;
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `s-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
