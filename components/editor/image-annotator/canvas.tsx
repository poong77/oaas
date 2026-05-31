'use client';

/**
 * Konva 기반 마크업 캔버스 — react-konva 사용.
 *
 * - props.image: 원본 이미지 element + 원본 px size
 * - props.maxView: 표시 영역 max width/height (실제 스테이지는 fit-scale)
 * - props.shapes / setShapes: 도형 상태 (controlled)
 * - props.tool / color: 현재 선택된 도구 / 색상
 * - 외부에서 ref.exportPng() 호출하여 PNG dataURL 또는 Blob 추출
 *
 * 좌표:
 *   - 모든 shape 좌표는 원본 이미지 px 기준 (확대/축소 무관)
 *   - 스테이지는 fitScale 로 표시 크기 조정 + 모든 도형도 같은 scale 사용
 */

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type Konva from 'konva';
import { Arrow, Image as KImage, Layer, Rect, Stage, Text, Group, Transformer } from 'react-konva';
import {
  type AnnotationColor,
  type AnnotationShape,
  COLOR_HEX,
  type FrameStyle,
  newId,
  type Tool,
} from './types';

export interface AnnotatorCanvasHandle {
  exportPng: () => Promise<Blob>;
}

interface CanvasProps {
  image: HTMLImageElement;
  width: number;
  height: number;
  maxView: { width: number; height: number };
  shapes: AnnotationShape[];
  onShapesChange: (next: AnnotationShape[] | ((prev: AnnotationShape[]) => AnnotationShape[])) => void;
  tool: Tool;
  color: AnnotationColor;
  frame: FrameStyle;
  selectedId: string | null;
  onSelectId: (id: string | null) => void;
  onRequestText: (worldX: number, worldY: number) => void;
}

export const AnnotatorCanvas = forwardRef<AnnotatorCanvasHandle, CanvasProps>(
  function AnnotatorCanvas(
    {
      image,
      width,
      height,
      maxView,
      shapes,
      onShapesChange,
      tool,
      color,
      frame,
      selectedId,
      onSelectId,
      onRequestText,
    },
    ref,
  ) {
    const stageRef = useRef<Konva.Stage>(null);
    const transformerRef = useRef<Konva.Transformer>(null);
    const [drawing, setDrawing] = useState<AnnotationShape | null>(null);

    // fit-scale 계산 (원본 → 표시)
    const scale = useMemo(() => {
      const sx = maxView.width / width;
      const sy = maxView.height / height;
      return Math.min(1, sx, sy);
    }, [maxView, width, height]);

    const stageW = Math.round(width * scale);
    const stageH = Math.round(height * scale);

    // 프레임 padding (그림자용 여백)
    const FRAME_PAD = frame === 'shadow' ? 24 : 0;
    const totalW = stageW + FRAME_PAD * 2;
    const totalH = stageH + FRAME_PAD * 2;

    // export 함수 노출
    useImperativeHandle(ref, () => ({
      async exportPng() {
        const stage = stageRef.current;
        if (!stage) throw new Error('Stage not ready');
        // 선택 해제 후 export (transformer 핸들 빠지게)
        onSelectId(null);
        await new Promise((r) => requestAnimationFrame(r));
        // 원본 해상도로 export — pixelRatio = 1/scale 하면 원본 px 1:1
        const ratio = 1 / scale;
        return new Promise<Blob>((resolve, reject) => {
          stage.toBlob({
            mimeType: 'image/png',
            pixelRatio: ratio,
            callback: (blob) => {
              if (blob) resolve(blob);
              else reject(new Error('toBlob failed'));
            },
          });
        });
      },
    }), [scale, onSelectId]);

    // 선택된 노드에 Transformer 연결
    useEffect(() => {
      const tr = transformerRef.current;
      const stage = stageRef.current;
      if (!tr || !stage) return;
      if (!selectedId) {
        tr.nodes([]);
        tr.getLayer()?.batchDraw();
        return;
      }
      const node = stage.findOne(`#${selectedId}`);
      if (node) {
        tr.nodes([node]);
        tr.getLayer()?.batchDraw();
      } else {
        tr.nodes([]);
      }
    }, [selectedId, shapes]);

    // 좌표 변환: 스테이지 mouse → 원본 이미지 좌표
    const toWorld = useCallback(
      (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>): { x: number; y: number } | null => {
        const stage = e.target.getStage();
        if (!stage) return null;
        const p = stage.getPointerPosition();
        if (!p) return null;
        return {
          x: (p.x - FRAME_PAD) / scale,
          y: (p.y - FRAME_PAD) / scale,
        };
      },
      [scale, FRAME_PAD],
    );

    function handleMouseDown(e: Konva.KonvaEventObject<MouseEvent>) {
      const target = e.target;
      // 빈 곳 클릭 = 선택 해제
      if (tool === 'cursor') {
        if (target === target.getStage() || target.name() === 'bg-image') {
          onSelectId(null);
        }
        return;
      }

      const world = toWorld(e);
      if (!world) return;

      // 이미지 바깥은 무시
      if (world.x < 0 || world.x > width || world.y < 0 || world.y > height) return;

      if (tool === 'arrow') {
        setDrawing({
          id: newId(),
          type: 'arrow',
          x1: world.x,
          y1: world.y,
          x2: world.x,
          y2: world.y,
          color,
          strokeWidth: 4,
        });
      } else if (tool === 'rect') {
        setDrawing({
          id: newId(),
          type: 'rect',
          x: world.x,
          y: world.y,
          width: 0,
          height: 0,
          color,
          strokeWidth: 3,
        });
      } else if (tool === 'text') {
        // 텍스트는 클릭만으로 prompt 띄움
        onRequestText(world.x, world.y);
      }
    }

    function handleMouseMove(e: Konva.KonvaEventObject<MouseEvent>) {
      if (!drawing) return;
      const world = toWorld(e);
      if (!world) return;
      if (drawing.type === 'arrow') {
        setDrawing({ ...drawing, x2: world.x, y2: world.y });
      } else if (drawing.type === 'rect') {
        setDrawing({
          ...drawing,
          width: world.x - drawing.x,
          height: world.y - drawing.y,
        });
      }
    }

    function handleMouseUp() {
      if (!drawing) return;
      // 너무 작은 도형은 버림 (실수 클릭 방지)
      if (drawing.type === 'arrow') {
        const dx = drawing.x2 - drawing.x1;
        const dy = drawing.y2 - drawing.y1;
        if (Math.hypot(dx, dy) < 8) {
          setDrawing(null);
          return;
        }
      } else if (drawing.type === 'rect') {
        // 음수 width/height 정규화
        const x = Math.min(drawing.x, drawing.x + drawing.width);
        const y = Math.min(drawing.y, drawing.y + drawing.height);
        const w = Math.abs(drawing.width);
        const h = Math.abs(drawing.height);
        if (w < 8 || h < 8) {
          setDrawing(null);
          return;
        }
        const norm: AnnotationShape = { ...drawing, x, y, width: w, height: h };
        onShapesChange((prev) => [...prev, norm]);
        setDrawing(null);
        return;
      }
      onShapesChange((prev) => [...prev, drawing]);
      setDrawing(null);
    }

    function handleShapeDrag(id: string, e: Konva.KonvaEventObject<DragEvent>) {
      const node = e.target;
      const dx = node.x() / scale - FRAME_PAD / scale;
      const dy = node.y() / scale - FRAME_PAD / scale;
      onShapesChange((prev) =>
        prev.map((s) => {
          if (s.id !== id) return s;
          if (s.type === 'arrow') {
            const w = s.x2 - s.x1;
            const h = s.y2 - s.y1;
            return { ...s, x1: dx, y1: dy, x2: dx + w, y2: dy + h };
          }
          if (s.type === 'rect') return { ...s, x: dx, y: dy };
          if (s.type === 'text') return { ...s, x: dx, y: dy };
          return s;
        }),
      );
      // reset node position (we drive via state)
      node.position({ x: FRAME_PAD + dx * scale, y: FRAME_PAD + dy * scale });
    }

    const allShapes = drawing ? [...shapes, drawing] : shapes;

    return (
      <Stage
        ref={stageRef}
        width={totalW}
        height={totalH}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleMouseDown as never}
        onTouchMove={handleMouseMove as never}
        onTouchEnd={handleMouseUp}
        style={{ cursor: tool === 'cursor' ? 'default' : 'crosshair' }}
      >
        <Layer>
          {/* 프레임 배경 (그림자용 흰색 padding) */}
          {frame === 'shadow' && (
            <Rect
              x={0}
              y={0}
              width={totalW}
              height={totalH}
              fill="#f8fafc"
            />
          )}
          {/* 그림자 효과는 이미지 group에 적용 */}
          <Group
            x={FRAME_PAD}
            y={FRAME_PAD}
            {...(frame === 'shadow' && {
              shadowColor: '#000',
              shadowBlur: 16,
              shadowOpacity: 0.18,
              shadowOffsetY: 6,
            })}
          >
            <KImage
              image={image}
              width={stageW}
              height={stageH}
              name="bg-image"
              cornerRadius={frame === 'shadow' ? 6 : 0}
            />
          </Group>

          {/* 도형 layer */}
          {allShapes.map((s) => {
            const isSelected = s.id === selectedId;
            if (s.type === 'arrow') {
              return (
                <Arrow
                  key={s.id}
                  id={s.id}
                  points={[
                    FRAME_PAD + s.x1 * scale,
                    FRAME_PAD + s.y1 * scale,
                    FRAME_PAD + s.x2 * scale,
                    FRAME_PAD + s.y2 * scale,
                  ]}
                  stroke={COLOR_HEX[s.color]}
                  fill={COLOR_HEX[s.color]}
                  strokeWidth={s.strokeWidth}
                  pointerLength={12}
                  pointerWidth={12}
                  lineCap="round"
                  lineJoin="round"
                  draggable={tool === 'cursor'}
                  onClick={() => tool === 'cursor' && onSelectId(s.id)}
                  onTap={() => tool === 'cursor' && onSelectId(s.id)}
                  onDragEnd={(e) => handleShapeDrag(s.id, e)}
                  shadowEnabled={isSelected}
                  shadowColor="#3b82f6"
                  shadowBlur={isSelected ? 6 : 0}
                />
              );
            }
            if (s.type === 'rect') {
              return (
                <Rect
                  key={s.id}
                  id={s.id}
                  x={FRAME_PAD + s.x * scale}
                  y={FRAME_PAD + s.y * scale}
                  width={s.width * scale}
                  height={s.height * scale}
                  stroke={COLOR_HEX[s.color]}
                  strokeWidth={s.strokeWidth}
                  draggable={tool === 'cursor'}
                  onClick={() => tool === 'cursor' && onSelectId(s.id)}
                  onTap={() => tool === 'cursor' && onSelectId(s.id)}
                  onDragEnd={(e) => handleShapeDrag(s.id, e)}
                />
              );
            }
            // text
            return (
              <Text
                key={s.id}
                id={s.id}
                x={FRAME_PAD + s.x * scale}
                y={FRAME_PAD + s.y * scale}
                text={s.text}
                fontSize={s.fontSize * scale}
                fontStyle="bold"
                fill={COLOR_HEX[s.color]}
                padding={s.hasBg ? 4 : 0}
                {...(s.hasBg && {
                  // Konva Text 자체엔 배경 없음. 별도 Rect로 흉내내려면 group 필요.
                  // MVP: 배경 옵션은 stroke로 가독성 보강
                  stroke: '#ffffff',
                  strokeWidth: 3,
                  fillAfterStrokeEnabled: true,
                })}
                draggable={tool === 'cursor'}
                onClick={() => tool === 'cursor' && onSelectId(s.id)}
                onTap={() => tool === 'cursor' && onSelectId(s.id)}
                onDragEnd={(e) => handleShapeDrag(s.id, e)}
              />
            );
          })}

          {tool === 'cursor' && (
            <Transformer
              ref={transformerRef}
              rotateEnabled={false}
              enabledAnchors={[
                'top-left',
                'top-right',
                'bottom-left',
                'bottom-right',
              ]}
              boundBoxFunc={(oldBox, newBox) => {
                if (newBox.width < 10 || newBox.height < 10) return oldBox;
                return newBox;
              }}
            />
          )}
        </Layer>
      </Stage>
    );
  },
);
