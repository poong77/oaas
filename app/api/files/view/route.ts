/**
 * `/api/files/view` — 에디터 본문 임베드 이미지 인증 프록시 (GET).
 *
 * 배경:
 *   - 업로드 버킷(`oaas-uploads-prd`)은 **비공개**. 원본 S3 URL 직접 접근 시 AccessDenied.
 *   - 에디터(아티클·티켓 답변 등) 본문에 임베드되는 이미지는 `ticket_attachments` 레코드가
 *     없어 `/api/attachments/[id]` 프록시를 쓸 수 없다. → 키 기반 전용 프록시.
 *
 * 보안:
 *   - 로그인 필수 (비로그인 401).
 *   - `editor/` prefix 객체만 허용 (isEditorUploadKey) → 버킷 내 임의 객체 읽기 차단.
 *   - 경로 traversal(`..`) 차단.
 *   ※ 티켓 단위 권한까지는 검증하지 않는다 (로그인 사용자 공통 열람). 본문 이미지는
 *     호텔 민감도가 낮고 키 추측이 어렵다(타임스탬프+랜덤). 더 강한 격리가 필요하면
 *     `/api/attachments/[id]`처럼 레코드+티켓 권한 모델로 승격할 것.
 *
 * 쿼리:
 *   - `key`: S3 객체 키 (업로드 응답의 `pathname`). URL 인코딩 권장.
 */

import { GetObjectCommand } from '@aws-sdk/client-s3';

import { getCurrentUser } from '@/lib/permissions';
import { env } from '@/lib/env';
import { getS3Client, isEditorUploadKey } from '@/lib/s3';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }
  if (!env.S3_UPLOAD_BUCKET) {
    return new Response('Service Unavailable', { status: 503 });
  }

  const raw = new URL(req.url).searchParams.get('key') ?? '';
  const key = raw.replace(/^\/+/, '');
  if (!key || key.includes('..') || !isEditorUploadKey(key)) {
    return new Response('Not Found', { status: 404 });
  }

  try {
    const out = await getS3Client().send(
      new GetObjectCommand({ Bucket: env.S3_UPLOAD_BUCKET, Key: key }),
    );
    if (!out.Body) {
      return new Response('Not Found', { status: 404 });
    }

    const headers = new Headers();
    headers.set('Content-Type', out.ContentType || 'application/octet-stream');
    headers.set('Content-Disposition', 'inline');
    if (out.ContentLength != null) {
      headers.set('Content-Length', String(out.ContentLength));
    }
    // 인증 게이트 통과 후 → private. 짧게 캐시.
    headers.set('Cache-Control', 'private, max-age=300');

    return new Response(out.Body.transformToWebStream(), {
      status: 200,
      headers,
    });
  } catch (err) {
    const name = err instanceof Error ? err.name : '';
    if (name === 'NoSuchKey' || name === 'NotFound') {
      return new Response('Not Found', { status: 404 });
    }
    console.error('[api/files/view] S3 GetObject 실패:', err);
    return new Response('Internal Server Error', { status: 500 });
  }
}
