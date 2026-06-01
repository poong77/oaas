/**
 * 이미지 처리 — Phase 5 D1·D2.
 *
 * - 자동 리사이징: max 폭 1920px (높이는 비율 유지)
 * - 포맷 최적화:
 *   · PNG → WebP (RGBA 보존, lossless 가까운 quality 90)
 *   · JPEG → 그대로 quality 85 (visually lossless)
 *   · WebP → 그대로 (이미 최적)
 *   · GIF/HEIC → 변환 안 함 (원본 유지, 호환성 우선)
 *
 * @see docs/02-design/knowledge-base-overhaul/DESIGN.md §13
 */

import 'server-only';
import sharp from 'sharp';

export const MAX_DIMENSION = 1920;
export const JPEG_QUALITY = 85;
export const WEBP_QUALITY = 90;

export type ProcessedImage = {
  /** 최적화된 바이너리 */
  buffer: Buffer;
  /** 최종 MIME 타입 (변환 후) */
  mimeType: string;
  /** 최종 확장자 (.webp / .jpg / .png 등) */
  ext: string;
  /** 최종 폭(px) */
  width: number;
  /** 최종 높이(px) */
  height: number;
  /** 원본 바이트 크기 */
  originalSize: number;
  /** 최적화된 바이트 크기 */
  optimizedSize: number;
  /** 리사이징/변환이 실제로 일어났는지 */
  modified: boolean;
};

/**
 * 이미지인지 빠른 판정 (MIME 또는 확장자 기준).
 */
export function isProcessableImage(mimeType: string, filename: string): boolean {
  if (mimeType.startsWith('image/')) {
    // HEIC/HEIF는 sharp가 OS 의존이라 변환 시도 안 함
    if (mimeType === 'image/heic' || mimeType === 'image/heif') return false;
    // GIF는 애니메이션 손상 위험으로 변환 안 함
    if (mimeType === 'image/gif') return false;
    return true;
  }
  // MIME 없을 때 확장자로 판정
  const ext = filename.split('.').pop()?.toLowerCase();
  if (!ext) return false;
  return ['jpg', 'jpeg', 'png', 'webp'].includes(ext);
}

/**
 * 이미지 변환 + 최적화.
 *
 * - 입력: ArrayBuffer (multipart form file.arrayBuffer())
 * - 출력: ProcessedImage
 * - 실패 시 throw — 호출처에서 원본 폴백 처리
 *
 * @example
 * const buf = await file.arrayBuffer();
 * const result = await processImage(buf, file.type, file.name);
 * await put(`editor/${userId}/${name}.${result.ext}`, result.buffer, {...});
 */
export async function processImage(
  buffer: ArrayBuffer | Buffer,
  inputMimeType: string,
  originalFilename: string,
): Promise<ProcessedImage> {
  const inputBuf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const originalSize = inputBuf.byteLength;

  const pipeline = sharp(inputBuf, { failOn: 'truncated' });
  const meta = await pipeline.metadata();

  if (!meta.width || !meta.height || !meta.format) {
    throw new Error('이미지 메타데이터를 읽을 수 없어요.');
  }

  // 자동 회전 (EXIF orientation 보정)
  pipeline.rotate();

  // 폭이 1920 초과면 비율 유지하며 리사이즈
  const needsResize = meta.width > MAX_DIMENSION;
  if (needsResize) {
    pipeline.resize({
      width: MAX_DIMENSION,
      withoutEnlargement: true,
      fit: 'inside',
    });
  }

  // 포맷별 변환
  let outBuffer: Buffer;
  let outMime: string;
  let outExt: string;

  switch (meta.format) {
    case 'png': {
      // PNG → WebP (투명도 보존, 30~50% 압축)
      outBuffer = await pipeline.webp({ quality: WEBP_QUALITY }).toBuffer();
      outMime = 'image/webp';
      outExt = 'webp';
      break;
    }
    case 'jpeg':
    case 'jpg': {
      outBuffer = await pipeline
        .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
        .toBuffer();
      outMime = 'image/jpeg';
      outExt = 'jpg';
      break;
    }
    case 'webp': {
      outBuffer = await pipeline.webp({ quality: WEBP_QUALITY }).toBuffer();
      outMime = 'image/webp';
      outExt = 'webp';
      break;
    }
    default: {
      // 그 외 포맷: 원본 그대로 반환 (sharp 처리 안 함)
      const ext = originalFilename.split('.').pop()?.toLowerCase() ?? 'bin';
      return {
        buffer: inputBuf,
        mimeType: inputMimeType,
        ext,
        width: meta.width,
        height: meta.height,
        originalSize,
        optimizedSize: originalSize,
        modified: false,
      };
    }
  }

  // 최종 dimensions 재측정
  const outMeta = await sharp(outBuffer).metadata();

  return {
    buffer: outBuffer,
    mimeType: outMime,
    ext: outExt,
    width: outMeta.width ?? meta.width,
    height: outMeta.height ?? meta.height,
    originalSize,
    optimizedSize: outBuffer.byteLength,
    modified: true,
  };
}

/**
 * 새 파일명 생성 — 원본 확장자를 새 확장자로 교체.
 *
 * `screenshot.png` + ext=webp → `screenshot.webp`
 * 확장자가 없으면 그대로 추가.
 */
export function replaceExtension(filename: string, newExt: string): string {
  const dot = filename.lastIndexOf('.');
  if (dot < 0) return `${filename}.${newExt}`;
  return `${filename.slice(0, dot)}.${newExt}`;
}
