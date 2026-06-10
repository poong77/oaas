/**
 * `/api/files/master-icon` — 마스터 아이콘 이미지 **공개 프록시** (GET, 인증 없음).
 *
 * 배경:
 *   - 업로드 버킷(`oaas-uploads-prd`)은 비공개라 원본 S3 URL 직접 접근 시 AccessDenied.
 *   - 마스터 아이콘(제품분류 대분류·역할별 시작)은 **공개 홈(비로그인)**에 노출돼야 한다.
 *     → `/api/files/view`(로그인 필수)를 쓸 수 없어 전용 공개 프록시를 둔다.
 *
 * 보안:
 *   - `master-icons/` prefix 객체만 허용 (isMasterIconKey) → 임의 객체 읽기 차단.
 *   - 경로 traversal(`..`) 차단.
 *   - 브랜드 아이콘은 민감도 없음 + 키 추측 어려움(타임스탬프+랜덤).
 *
 * 쿼리:
 *   - `key`: S3 객체 키 (업로드 응답 `pathname`).
 */

import { GetObjectCommand } from '@aws-sdk/client-s3';

import { env } from '@/lib/env';
import { getS3Client, isMasterIconKey } from '@/lib/s3';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  if (!env.S3_UPLOAD_BUCKET) {
    return new Response('Service Unavailable', { status: 503 });
  }

  const raw = new URL(req.url).searchParams.get('key') ?? '';
  const key = raw.replace(/^\/+/, '');
  if (!key || key.includes('..') || !isMasterIconKey(key)) {
    return new Response('Not Found', { status: 404 });
  }

  try {
    const out = await getS3Client().send(
      new GetObjectCommand({ Bucket: env.S3_UPLOAD_BUCKET, Key: key }),
    );
    if (!out.Body) return new Response('Not Found', { status: 404 });

    const headers = new Headers();
    headers.set('Content-Type', out.ContentType || 'image/png');
    headers.set('Content-Disposition', 'inline');
    if (out.ContentLength != null) {
      headers.set('Content-Length', String(out.ContentLength));
    }
    // 공개 아이콘 — 장기 캐시 (CDN/브라우저). 키가 매 업로드마다 유니크해 무효화 불필요.
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');

    return new Response(out.Body.transformToWebStream(), {
      status: 200,
      headers,
    });
  } catch (err) {
    const name = err instanceof Error ? err.name : '';
    if (name === 'NoSuchKey' || name === 'NotFound') {
      return new Response('Not Found', { status: 404 });
    }
    console.error('[api/files/master-icon] S3 GetObject 실패:', err);
    return new Response('Internal Server Error', { status: 500 });
  }
}
