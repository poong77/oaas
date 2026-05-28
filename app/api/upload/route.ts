/**
 * `/api/upload` — Vercel Blob 업로드 (Phase 5 IC-02).
 *
 * 요청: multipart/form-data (FormData)
 *   - `file`: 단일 파일
 *   - `purpose`: 'ticket' (기본) — 향후 다른 용도로 확장 가능
 *
 * 응답 (성공):
 *   { ok: true, blobUrl, pathname, originalName, mimeType, sizeBytes }
 *
 * 응답 (실패):
 *   { ok: false, message }
 *
 * 보안:
 *   - 로그인 필수 (`requireAuth` X — Route Handler에서는 getCurrentUser).
 *   - 파일 확장자 / mime 화이트리스트.
 *   - 최대 50MB (BLOB API 자체 한계도 50MB).
 *   - 인증된 사용자 ID를 staging pathname에 포함하여 사용자별 격리.
 *
 * 토큰 미설정 (`BLOB_READ_WRITE_TOKEN` 비어있음) 시 503 반환.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { put } from '@vercel/blob';
import { getCurrentUser } from '@/lib/permissions';
import { env } from '@/lib/env';

export const runtime = 'nodejs';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

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

  if (!env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      {
        ok: false,
        message:
          'Vercel Blob 토큰이 설정되지 않았습니다 (BLOB_READ_WRITE_TOKEN).',
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

  const purpose = (formData.get('purpose')?.toString() ?? 'ticket').replace(
    /[^a-z]/gi,
    '',
  );
  const uniq = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const safeName = sanitizePathSegment(file.name || 'file');
  const pathname = `tickets/_staging/${purpose}/${user.id}/${uniq}-${safeName}`;

  try {
    const result = await put(pathname, file, {
      access: 'public',
      addRandomSuffix: false,
      token: env.BLOB_READ_WRITE_TOKEN,
    });
    return NextResponse.json({
      ok: true,
      blobUrl: result.url,
      pathname: result.pathname,
      originalName: file.name,
      mimeType: file.type || null,
      sizeBytes: file.size,
    });
  } catch (err) {
    console.error('[api/upload] Vercel Blob put 실패:', err);
    return NextResponse.json(
      {
        ok: false,
        message:
          err instanceof Error ? err.message : 'Blob 업로드 중 오류가 발생했습니다',
      },
      { status: 500 },
    );
  }
}
