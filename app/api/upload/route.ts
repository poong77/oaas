/**
 * `/api/upload` — S3 첨부 업로드 (Phase 5 IC-02, 자체 호스팅 이전 후).
 *
 * 요청: multipart/form-data (FormData)
 *   - `file`: 단일 파일
 *   - `purpose`: 'ticket' (기본) — 향후 다른 용도로 확장 가능
 *
 * 응답 (성공):
 *   { ok: true, blobUrl, pathname, originalName, mimeType, sizeBytes }
 *   ※ `blobUrl` 필드명은 클라이언트 호환성을 위해 유지 (실제로는 S3/CloudFront URL).
 *
 * 응답 (실패):
 *   { ok: false, message }
 *
 * 보안:
 *   - 로그인 필수 (`requireAuth` X — Route Handler에서는 getCurrentUser).
 *   - 파일 확장자 / mime 화이트리스트.
 *   - 최대 50MB.
 *   - 인증된 사용자 ID를 키에 포함하여 사용자별 격리.
 *
 * 버킷 미설정 (`S3_UPLOAD_BUCKET` 비어있음) 시 503 반환.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getCurrentUser } from '@/lib/permissions';
import { env } from '@/lib/env';
import { getS3Client, buildPublicUrl } from '@/lib/s3';
import { checkRateLimit } from '@/lib/rate-limit';
import {
  isProcessableImage,
  processImage,
  replaceExtension,
} from '@/lib/images/processor';

export const runtime = 'nodejs';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
/** Rate Limit: editor 분당 30회 / ticket 첨부 분당 20회 */
const RATE_LIMIT_PER_MINUTE = { editor: 30, ticket: 20 } as const;
/** purpose 화이트리스트 — pathname 분기에 사용 */
const ALLOWED_PURPOSES = new Set(['ticket', 'editor']);

const ALLOWED_MIME_PREFIX = [
  'image/', // jpg, png, gif, webp, heic
  'video/', // mp4, mov 등
  'application/pdf',
  'application/zip',
  'application/x-zip-compressed',
  'application/x-gzip',
  'text/plain',
  'application/json',
  'application/octet-stream', // .log 파일 등이 종종 이걸로 옴
];

const ALLOWED_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'heic',
  'heif',
  'mp4',
  'mov',
  'm4v',
  'pdf',
  'zip',
  'gz',
  'tgz',
  'log',
  'txt',
  'json',
]);

function isAllowedFile(file: File): boolean {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext && ALLOWED_EXTENSIONS.has(ext)) return true;
  if (file.type && ALLOWED_MIME_PREFIX.some((p) => file.type.startsWith(p))) {
    return true;
  }
  return false;
}

function sanitizePathSegment(input: string): string {
  return input
    .replace(/[^\w.\-가-힣]/g, '_')
    .replace(/__+/g, '_')
    .slice(0, 120);
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, message: '로그인이 필요합니다' },
      { status: 401 },
    );
  }

  if (!env.S3_UPLOAD_BUCKET) {
    return NextResponse.json(
      {
        ok: false,
        message:
          'S3 업로드 버킷이 설정되지 않았습니다 (S3_UPLOAD_BUCKET).',
      },
      { status: 503 },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: '잘못된 요청 형식입니다' },
      { status: 400 },
    );
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json(
      { ok: false, message: '파일이 첨부되지 않았습니다' },
      { status: 400 },
    );
  }

  if (file.size <= 0) {
    return NextResponse.json(
      { ok: false, message: '빈 파일입니다' },
      { status: 400 },
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      {
        ok: false,
        message: `파일이 너무 큽니다 (최대 ${Math.floor(MAX_FILE_SIZE / 1024 / 1024)}MB)`,
      },
      { status: 413 },
    );
  }

  if (!isAllowedFile(file)) {
    return NextResponse.json(
      {
        ok: false,
        message:
          '허용되지 않는 파일 형식입니다 (이미지/비디오/PDF/ZIP/로그/텍스트만 가능)',
      },
      { status: 415 },
    );
  }

  const rawPurpose = (formData.get('purpose')?.toString() ?? 'ticket')
    .replace(/[^a-z]/gi, '')
    .toLowerCase();
  const purpose: 'ticket' | 'editor' = ALLOWED_PURPOSES.has(rawPurpose)
    ? (rawPurpose as 'ticket' | 'editor')
    : 'ticket';

  // Rate Limit (사용자별) — editor는 분당 30회, ticket 첨부는 분당 20회
  const rlMax = RATE_LIMIT_PER_MINUTE[purpose];
  const rl = checkRateLimit(`upload:${purpose}:${user.id}`, rlMax);
  if (!rl.ok) {
    return NextResponse.json(
      {
        ok: false,
        message: `업로드 횟수 제한을 초과했습니다 (분당 ${rlMax}회). ${rl.retryAfter}초 후 다시 시도해주세요.`,
      },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } },
    );
  }

  const uniq = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let safeName = sanitizePathSegment(file.name || 'file');

  // ─── Phase 5 D1·D2: editor + image면 sharp 자동 변환 ─────────────────
  // - max 폭 1920px, PNG→WebP, JPEG q85, EXIF 자동 회전
  // - 실패 시 원본 그대로 폴백 (호환성 우선)
  // - ticket purpose나 비이미지(PDF/zip 등)는 변환 안 함
  let uploadPayload: Blob | File = file;
  let uploadContentType: string | undefined = file.type || undefined;
  let finalSizeBytes = file.size;
  let imageMeta: {
    optimized: boolean;
    width?: number;
    height?: number;
    originalSize: number;
    optimizedSize: number;
  } = {
    optimized: false,
    originalSize: file.size,
    optimizedSize: file.size,
  };

  if (purpose === 'editor' && isProcessableImage(file.type, file.name)) {
    try {
      const arrayBuf = await file.arrayBuffer();
      const processed = await processImage(arrayBuf, file.type, file.name);
      if (processed.modified) {
        const newBlob = new Blob([new Uint8Array(processed.buffer)], {
          type: processed.mimeType,
        });
        uploadPayload = newBlob;
        uploadContentType = processed.mimeType;
        finalSizeBytes = processed.optimizedSize;
        safeName = replaceExtension(safeName, processed.ext);
      }
      imageMeta = {
        optimized: processed.modified,
        width: processed.width,
        height: processed.height,
        originalSize: processed.originalSize,
        optimizedSize: processed.optimizedSize,
      };
    } catch (err) {
      // 변환 실패는 fatal 아님 — 원본 그대로 업로드
      console.warn(
        '[api/upload] sharp 변환 실패, 원본 폴백:',
        err instanceof Error ? err.message : err,
      );
    }
  }

  // purpose별 pathname 분기:
  //   - 'editor' → editor/{userId}/{uniq}-{name}     (본문 임베드 이미지·PDF)
  //   - 'ticket' → tickets/_staging/{purpose}/{userId}/{uniq}-{name}  (티켓 첨부)
  const basePathname =
    purpose === 'editor'
      ? `editor/${user.id}/${uniq}-${safeName}`
      : `tickets/_staging/${purpose}/${user.id}/${uniq}-${safeName}`;
  const key = env.S3_UPLOAD_PREFIX
    ? `${env.S3_UPLOAD_PREFIX.replace(/^\/+|\/+$/g, '')}/${basePathname}`
    : basePathname;

  try {
    const bodyBuffer = Buffer.from(
      await (uploadPayload instanceof Blob
        ? uploadPayload.arrayBuffer()
        : (uploadPayload as File).arrayBuffer()),
    );
    await getS3Client().send(
      new PutObjectCommand({
        Bucket: env.S3_UPLOAD_BUCKET,
        Key: key,
        Body: bodyBuffer,
        ContentType: uploadContentType,
        ContentLength: bodyBuffer.length,
      }),
    );
    return NextResponse.json({
      ok: true,
      blobUrl: buildPublicUrl(key),
      pathname: key,
      originalName: file.name,
      mimeType: uploadContentType ?? file.type ?? null,
      sizeBytes: finalSizeBytes,
      // Phase 5 메타: 클라이언트가 절감률 표시 가능
      image: imageMeta.optimized ? imageMeta : undefined,
    });
  } catch (err) {
    console.error('[api/upload] S3 PutObject 실패:', err);
    return NextResponse.json(
      {
        ok: false,
        message:
          err instanceof Error ? err.message : 'S3 업로드 중 오류가 발생했습니다',
      },
      { status: 500 },
    );
  }
}
