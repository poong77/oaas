'use client';

/**
 * Konva 기반 마크업 캔버스 — react-konva 사용.
 *
 * - props.image: 원본 이미지 element + 원본 px size
 * - props.maxView: 표시 영역 max width/height (실제 스테이지는 fit-scale)
 * - props.shapes / setShapes: 도형 상태 (controlled)
 * - props.tool / color: 현재 선택된 도구 / 색상
 * - props.frame: 'none' / 'shadow' / 'browser'
 * - 외부에서 ref.exportPng() 호출하여 PNG dataURL 또는 Blob 추출
 *
 * 좌표:
 *   - 모든 shape 좌표는 원본 이미지 px 기준 (확대/축소 무관)
 *   - 스테이지는 fit-scale 로 표시 크기 조정 + 모든 도형도 같은 scale 사용
 *   - 이미지 좌상단 = (imgOffsetX, imgOffsetY) — 프레임 종류에 따라 달라짐
 */

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type Konva from 'konva';
import {
  Arrow,
  Circle,
  Group,
  Image as KImage,
  Layer,
  Rect,
  Stage,
  Text,
  Transformer,
} from 'react-konva';
import {
  type AnnotationColor,
  type AnnotationShape,
  type BgColor,
  BG_GRADIENTS,
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
  bgColor: BgColor;
  selectedId: string | null;
  onSelectId: (id: string | null) => void;
  onRequestText: (worldX: number, worldY: number) => void;
}

// 프레임 종류별 레이아웃 메트릭 (스테이지 표시 좌표)
const BROWSER_BAR_HEIGHT = 36;
const BROWSER_PAD = 16;
const SHADOW_PAD = 24;
// iPhone (Dynamic Island 세대)
const IPHONE_BEZEL = 12;
const IPHONE_TOP_CHIN = 22;     // Dynamic Island 영역 여백
const IPHONE_BOTTOM_CHIN = 16;
const IPHONE_OUTER_PAD = 28;    // 그림자 + 배경 패딩
const IPHONE_BODY_RADIUS = 38;
const IPHONE_SCREEN_RADIUS = 22;
// MacBook
const MAC_BEZEL = 12;
const MAC_TOP_BEZEL = 18;       // 카메라 노치 영역
const MAC_BOTTOM_CHIN = 18;
const MAC_BASE_HEIGHT = 8;      // 디스플레이 아래 스탠드 표시
const MAC_BASE_OVERHANG = 28;   // 디스플레이 양옆에서 스탠드가 더 넓게
const MAC_OUTER_PAD = 28;
const MAC_DISPLAY_RADIUS = 12;

interface FrameMetrics {
  /** 이미지 좌상단의 stage x */
  imgOffsetX: number;
  /** 이미지 좌상단의 stage y */
  imgOffsetY: number;
  /** 전체 stage 너비 */
  stageTotalW: number;
  /** 전체 stage 높이 */
  stageTotalH: number;
}

function getFrameMetrics(
  frame: FrameStyle,
  stageW: number,
  stageH: number,
): FrameMetrics {
  if (frame === 'shadow') {
    return {
      imgOffsetX: SHADOW_PAD,
      imgOffsetY: SHADOW_PAD,
      stageTotalW: stageW + SHADOW_PAD * 2,
      stageTotalH: stageH + SHADOW_PAD * 2,
    };
  }
  if (frame === 'browser') {
    return {
      imgOffsetX: BROWSER_PAD,
      imgOffsetY: BROWSER_PAD + BROWSER_BAR_HEIGHT,
      stageTotalW: stageW + BROWSER_PAD * 2,
      stageTotalH: stageH + BROWSER_BAR_HEIGHT + BROWSER_PAD * 2,
    };
  }
  if (frame === 'iphone') {
    return {
      imgOffsetX: IPHONE_OUTER_PAD + IPHONE_BEZEL,
      imgOffsetY: IPHONE_OUTER_PAD + IPHONE_BEZEL + IPHONE_TOP_CHIN,
      stageTotalW: stageW + (IPHONE_OUTER_PAD + IPHONE_BEZEL) * 2,
      stageTotalH:
        stageH +
        (IPHONE_OUTER_PAD + IPHONE_BEZEL) * 2 +
        IPHONE_TOP_CHIN +
        IPHONE_BOTTOM_CHIN,
    };
  }
  if (frame === 'macbook') {
    return {
      imgOffsetX: MAC_OUTER_PAD + MAC_BASE_OVERHANG + MAC_BEZEL,
      imgOffsetY: MAC_OUTER_PAD + MAC_TOP_BEZEL,
      stageTotalW: stageW + (MAC_OUTER_PAD + MAC_BASE_OVERHANG + MAC_BEZEL) * 2,
      stageTotalH:
        stageH +
        MAC_TOP_BEZEL +
        MAC_BOTTOM_CHIN +
        MAC_BASE_HEIGHT +
        MAC_OUTER_PAD * 2,
    };
  }
  return {
    imgOffsetX: 0,
    imgOffsetY: 0,
    stageTotalW: stageW,
    stageTotalH: stageH,
  };
}

/** 사용 가능한 viewport 에서 프레임 padding 빼고 이미지에 할당 가능한 영역 계산. */
function getFramePadding(frame: FrameStyle): { w: number; h: number } {
  switch (frame) {
    case 'shadow':
      return { w: SHADOW_PAD * 2, h: SHADOW_PAD * 2 };
    case 'browser':
      return { w: BROWSER_PAD * 2, h: BROWSER_PAD * 2 + BROWSER_BAR_HEIGHT };
    case 'iphone':
      return {
        w: (IPHONE_OUTER_PAD + IPHONE_BEZEL) * 2,
        h:
          (IPHONE_OUTER_PAD + IPHONE_BEZEL) * 2 +
          IPHONE_TOP_CHIN +
          IPHONE_BOTTOM_CHIN,
      };
    case 'macbook':
      return {
        w: (MAC_OUTER_PAD + MAC_BASE_OVERHANG + MAC_BEZEL) * 2,
        h: MAC_TOP_BEZEL + MAC_BOTTOM_CHIN + MAC_BASE_HEIGHT + MAC_OUTER_PAD * 2,
      };
    default:
      return { w: 0, h: 0 };
  }
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
      bgColor,
      selectedId,
      onSelectId,
      onRequestText,
    },
    ref,
  ) {
    const stageRef = useRef<Konva.Stage>(null);
    const transformerRef = useRef<Konva.Transformer>(null);
    const [drawing, setDrawing] = useState<AnnotationShape | null>(null);

    // fit-scale 계산 — 프레임 padding 까지 고려해서 viewport 안에 들어가도록
    const scale = useMemo(() => {
      const pad = getFramePadding(frame);
      const availW = maxView.width - pad.w;
      const availH = maxView.height - pad.h;
      const sx = availW / width;
      const sy = availH / height;
      return Math.min(1, sx, sy);
    }, [maxView, width, height, frame]);

    const stageW = Math.round(width * scale);
    const stageH = Math.round(height * scale);

    const { imgOffsetX, imgOffsetY, stageTotalW, stageTotalH } = useMemo(
      () => getFrameMetrics(frame, stageW, stageH),
      [frame, stageW, stageH],
    );

    // export 함수 노출
    useImperativeHandle(ref, () => ({
      async exportPng() {
        const stage = stageRef.current;
        if (!stage) throw new Error('Stage not ready');
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
          x: (p.x - imgOffsetX) / scale,
          y: (p.y - imgOffsetY) / scale,
        };
      },
      [scale, imgOffsetX, imgOffsetY],
    );

    function handleMouseDown(e: Konva.KonvaEventObject<MouseEvent>) {
      const target = e.target;
      // 빈 곳/이미지/프레임 클릭 = 선택 해제 (커서 모드)
      if (tool === 'cursor') {
        const name = target.name();
        if (
          target === target.getStage() ||
          name === 'bg-image' ||
          name === 'frame-bg'
        ) {
          onSelectId(null);
        }
        return;
      }

      const world = toWorld(e);
      if (!world) return;

      // 이미지 영역 바깥은 무시 (프레임 chrome 위에 그리지 못하도록)
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
      if (drawing.type === 'arrow') {
        const dx = drawing.x2 - drawing.x1;
        const dy = drawing.y2 - drawing.y1;
        if (Math.hypot(dx, dy) < 8) {
          setDrawing(null);
          return;
        }
      } else if (drawing.type === 'rect') {
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
      const dx = (node.x() - imgOffsetX) / scale;
      const dy = (node.y() - imgOffsetY) / scale;
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
      node.position({ x: imgOffsetX + dx * scale, y: imgOffsetY + dy * scale });
    }

    const allShapes = drawing ? [...shapes, drawing] : shapes;

    // 브라우저 프레임 chrome 메트릭 (stage 좌표)
    const browserChromeX = BROWSER_PAD;
    const browserChromeY = BROWSER_PAD;
    const browserChromeW = stageW;
    const browserChromeH = BROWSER_BAR_HEIGHT + stageH;

    return (
      <Stage
        ref={stageRef}
        width={stageTotalW}
        height={stageTotalH}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleMouseDown as never}
        onTouchMove={handleMouseMove as never}
        onTouchEnd={handleMouseUp}
        style={{ cursor: tool === 'cursor' ? 'default' : 'crosshair' }}
      >
        <Layer>
          {/* 프레임 배경 (export 시 투명 영역 방지) — 사용자 선택 그라데이션 */}
          {frame !== 'none' && (() => {
            const [c0, c1] = BG_GRADIENTS[bgColor];
            return (
              <Rect
                x={0}
                y={0}
                width={stageTotalW}
                height={stageTotalH}
                fillLinearGradientStartPoint={{ x: 0, y: 0 }}
                fillLinearGradientEndPoint={{ x: stageTotalW, y: stageTotalH }}
                fillLinearGradientColorStops={[0, c0, 1, c1]}
                name="frame-bg"
              />
            );
          })()}

          {/* 그림자 프레임 (소프트 다층 그림자 + 라운드 코너) */}
          {frame === 'shadow' && (
            <Group x={imgOffsetX} y={imgOffsetY}>
              {/* 보조 흐릿한 그림자 (더 멀리, 더 부드럽게) */}
              <Rect
                x={0}
                y={4}
                width={stageW}
                height={stageH}
                fill="#000"
                opacity={0.06}
                cornerRadius={10}
                shadowColor="#000"
                shadowBlur={30}
                shadowOpacity={0.5}
                shadowOffsetY={14}
                listening={false}
              />
              {/* 메인 이미지 + 진한 그림자 */}
              <KImage
                image={image}
                width={stageW}
                height={stageH}
                name="bg-image"
                cornerRadius={10}
                shadowColor="#0f172a"
                shadowBlur={20}
                shadowOpacity={0.25}
                shadowOffsetY={8}
              />
            </Group>
          )}

          {/* 브라우저 프레임 (mac 스타일 신호등 + URL 바) */}
          {frame === 'browser' && (
            <Group
              x={browserChromeX}
              y={browserChromeY}
              shadowColor="#000"
              shadowBlur={20}
              shadowOpacity={0.22}
              shadowOffsetY={8}
            >
              {/* 전체 chrome 배경 (둥근 모서리) */}
              <Rect
                x={0}
                y={0}
                width={browserChromeW}
                height={browserChromeH}
                fill="#ffffff"
                cornerRadius={10}
                name="frame-bg"
              />
              {/* 상단 toolbar (회색) */}
              <Rect
                x={0}
                y={0}
                width={browserChromeW}
                height={BROWSER_BAR_HEIGHT}
                fill="#f1f3f5"
                cornerRadius={[10, 10, 0, 0]}
                name="frame-bg"
              />
              {/* toolbar 하단 1px 구분선 */}
              <Rect
                x={0}
                y={BROWSER_BAR_HEIGHT - 1}
                width={browserChromeW}
                height={1}
                fill="#e2e8f0"
                listening={false}
              />
              {/* 신호등 3개 (close / minimize / maximize) */}
              <Circle x={16} y={BROWSER_BAR_HEIGHT / 2} radius={6} fill="#ff5f57" stroke="#e0443e" strokeWidth={0.5} />
              <Circle x={34} y={BROWSER_BAR_HEIGHT / 2} radius={6} fill="#febc2e" stroke="#dea123" strokeWidth={0.5} />
              <Circle x={52} y={BROWSER_BAR_HEIGHT / 2} radius={6} fill="#28c840" stroke="#1aab29" strokeWidth={0.5} />
              {/* URL 바 (가운데 정렬) */}
              {browserChromeW > 220 && (() => {
                const urlBarW = Math.min(420, browserChromeW * 0.5);
                const urlBarX = (browserChromeW - urlBarW) / 2;
                const urlBarH = 20;
                const urlBarY = (BROWSER_BAR_HEIGHT - urlBarH) / 2;
                return (
                  <>
                    <Rect
                      x={urlBarX}
                      y={urlBarY}
                      width={urlBarW}
                      height={urlBarH}
                      fill="#ffffff"
                      cornerRadius={5}
                      stroke="#d4d4d8"
                      strokeWidth={0.5}
                      listening={false}
                    />
                    <Text
                      x={urlBarX}
                      y={urlBarY}
                      width={urlBarW}
                      height={urlBarH}
                      text="support.oapms.com"
                      fontSize={11}
                      fontFamily="-apple-system, BlinkMacSystemFont, system-ui, sans-serif"
                      fill="#71717a"
                      align="center"
                      verticalAlign="middle"
                      listening={false}
                    />
                  </>
                );
              })()}
              {/* 실제 이미지 */}
              <KImage
                image={image}
                x={0}
                y={BROWSER_BAR_HEIGHT}
                width={stageW}
                height={stageH}
                name="bg-image"
                cornerRadius={[0, 0, 10, 10]}
              />
            </Group>
          )}

          {/* iPhone 프레임 — Dynamic Island 세대 */}
          {frame === 'iphone' && (() => {
            const bodyX = IPHONE_OUTER_PAD;
            const bodyY = IPHONE_OUTER_PAD;
            const bodyW = stageW + IPHONE_BEZEL * 2;
            const bodyH =
              stageH + IPHONE_BEZEL * 2 + IPHONE_TOP_CHIN + IPHONE_BOTTOM_CHIN;
            // Dynamic Island: 중앙 상단 pill
            const diW = Math.min(110, bodyW * 0.32);
            const diH = 24;
            const diX = bodyX + (bodyW - diW) / 2;
            const diY = bodyY + 12;
            return (
              <Group
                shadowColor="#0f172a"
                shadowBlur={30}
                shadowOpacity={0.3}
                shadowOffsetY={14}
              >
                {/* 본체 (matte black) */}
                <Rect
                  x={bodyX}
                  y={bodyY}
                  width={bodyW}
                  height={bodyH}
                  fill="#0b0b0d"
                  cornerRadius={IPHONE_BODY_RADIUS}
                  stroke="#2a2a2e"
                  strokeWidth={1}
                  name="frame-bg"
                />
                {/* 본체 highlight (위쪽 살짝 라이트) */}
                <Rect
                  x={bodyX + 4}
                  y={bodyY + 2}
                  width={bodyW - 8}
                  height={bodyH - 4}
                  cornerRadius={IPHONE_BODY_RADIUS - 4}
                  fillLinearGradientStartPoint={{ x: 0, y: 0 }}
                  fillLinearGradientEndPoint={{ x: 0, y: bodyH }}
                  fillLinearGradientColorStops={[0, '#1a1a1c', 0.5, '#0b0b0d', 1, '#1a1a1c']}
                  listening={false}
                />
                {/* 실제 이미지 (스크린) */}
                <KImage
                  image={image}
                  x={imgOffsetX}
                  y={imgOffsetY}
                  width={stageW}
                  height={stageH}
                  name="bg-image"
                  cornerRadius={IPHONE_SCREEN_RADIUS}
                />
                {/* Dynamic Island (스크린 위 floating) */}
                <Rect
                  x={diX}
                  y={diY}
                  width={diW}
                  height={diH}
                  fill="#0a0a0a"
                  cornerRadius={diH / 2}
                  stroke="#1f1f22"
                  strokeWidth={0.5}
                  listening={false}
                />
              </Group>
            );
          })()}

          {/* MacBook 프레임 */}
          {frame === 'macbook' && (() => {
            const displayX = MAC_OUTER_PAD + MAC_BASE_OVERHANG;
            const displayY = MAC_OUTER_PAD;
            const displayW = stageW + MAC_BEZEL * 2;
            const displayH = stageH + MAC_TOP_BEZEL + MAC_BOTTOM_CHIN;
            // 스탠드 (디스플레이 양옆으로 더 넓게)
            const baseX = MAC_OUTER_PAD;
            const baseY = displayY + displayH;
            const baseW = displayW + MAC_BASE_OVERHANG * 2;
            const baseH = MAC_BASE_HEIGHT;
            // 카메라 노치
            const notchW = 56;
            const notchH = 8;
            const notchX = displayX + (displayW - notchW) / 2;
            const notchY = displayY + 4;
            return (
              <Group
                shadowColor="#0f172a"
                shadowBlur={28}
                shadowOpacity={0.28}
                shadowOffsetY={14}
              >
                {/* 디스플레이 본체 */}
                <Rect
                  x={displayX}
                  y={displayY}
                  width={displayW}
                  height={displayH}
                  fill="#1a1a1c"
                  cornerRadius={MAC_DISPLAY_RADIUS}
                  stroke="#3a3a3e"
                  strokeWidth={1}
                  name="frame-bg"
                />
                {/* 실제 이미지 (스크린) */}
                <KImage
                  image={image}
                  x={imgOffsetX}
                  y={imgOffsetY}
                  width={stageW}
                  height={stageH}
                  name="bg-image"
                />
                {/* 카메라 노치 */}
                <Rect
                  x={notchX}
                  y={notchY}
                  width={notchW}
                  height={notchH}
                  fill="#0a0a0a"
                  cornerRadius={4}
                  listening={false}
                />
                {/* 하단 chin 의 작은 "<>" Apple 표시 자리 (도트 1개로 단순화) */}
                <Circle
                  x={displayX + displayW / 2}
                  y={displayY + displayH - MAC_BOTTOM_CHIN / 2}
                  radius={1.2}
                  fill="#3a3a3e"
                  listening={false}
                />
                {/* 스탠드 (사다리꼴 느낌 — Konva 는 polygon 없이 trapezoid 어려워 둥근 사각형으로 대체) */}
                <Rect
                  x={baseX}
                  y={baseY}
                  width={baseW}
                  height={baseH}
                  fillLinearGradientStartPoint={{ x: 0, y: 0 }}
                  fillLinearGradientEndPoint={{ x: 0, y: baseH }}
                  fillLinearGradientColorStops={[0, '#2a2a2e', 1, '#1a1a1c']}
                  cornerRadius={[0, 0, 4, 4]}
                  listening={false}
                />
                {/* 스탠드 가운데 살짝 패인 그루브 */}
                <Rect
                  x={baseX + baseW / 2 - 30}
                  y={baseY}
                  width={60}
                  height={2}
                  fill="#0a0a0a"
                  cornerRadius={1}
                  listening={false}
                />
              </Group>
            );
          })()}

          {/* 프레임 없음 — 이미지만 */}
          {frame === 'none' && (
            <KImage
              image={image}
              x={imgOffsetX}
              y={imgOffsetY}
              width={stageW}
              height={stageH}
              name="bg-image"
            />
          )}

          {/* 도형 layer — 이미지 좌상단 (imgOffsetX, imgOffsetY) 기준
              hitStrokeWidth: 클릭 인식 영역 확장 (cursor 모드에서 도형 선택을 쉽게) */}
          {allShapes.map((s) => {
            const isSelected = s.id === selectedId;
            if (s.type === 'arrow') {
              return (
                <Arrow
                  key={s.id}
                  id={s.id}
                  points={[
                    imgOffsetX + s.x1 * scale,
                    imgOffsetY + s.y1 * scale,
                    imgOffsetX + s.x2 * scale,
                    imgOffsetY + s.y2 * scale,
                  ]}
                  stroke={COLOR_HEX[s.color]}
                  fill={COLOR_HEX[s.color]}
                  strokeWidth={s.strokeWidth}
                  hitStrokeWidth={24}
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
                  x={imgOffsetX + s.x * scale}
                  y={imgOffsetY + s.y * scale}
                  width={s.width * scale}
                  height={s.height * scale}
                  stroke={COLOR_HEX[s.color]}
                  strokeWidth={s.strokeWidth}
                  hitStrokeWidth={Math.max(20, s.strokeWidth + 18)}
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
                x={imgOffsetX + s.x * scale}
                y={imgOffsetY + s.y * scale}
                text={s.text}
                fontSize={s.fontSize * scale}
                fontStyle="bold"
                fill={COLOR_HEX[s.color]}
                padding={s.hasBg ? 4 : 0}
                {...(s.hasBg && {
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
