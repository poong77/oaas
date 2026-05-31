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

export type FrameStyle = 'none' | 'shadow' | 'browser';

/** FrameStyle 별 표시 라벨. */
export const FRAME_LABEL: Record<FrameStyle, string> = {
  none: '없음',
  shadow: '그림자',
  browser: '브라우저',
};

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
