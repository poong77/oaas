/**
 * `/api/files/popup` — 홈 팝업 배너 이미지 **공개 프록시** (GET, 인증 없음).
 *
 * 배경:
 *   - 업로드 버킷(`oaas-uploads-prd`)은 비공개라 원본 S3 URL 직접 접근 시 AccessDenied.
 *   - 팝업 배너 이미지는 `editor/` prefix로 업로드되어 로그인 필수 `/api/files/view`로
 *     저장된다. 하지만 팝업 배너는 **비로그인 홈(랜딩)**에도 노출돼야 한다.
 *     → editor 프록시(로그인 필수)를 못 쓰므로 전용 공개 프록시를 둔다.
 *
 * 보안:
 *   - `editor/` 전체를 무인증 공개하면 본문 임베드 이미지까지 새므로, **DB에 등록된
 *     활성 팝업 공지가 실제로 참조하는 키만** 스트리밍한다(isActivePopupImageKey).
 *   - 경로 traversal(`..`) 차단.
 *
 * 쿼리:
 *   - `key`: S3 객체 키 (업로드 응답 `pathname`).
 */

import { GetObjectCommand } from '@aws-sdk/client-s3';

import { env } from '@/lib/env';
import { getS3Client } from '@/lib/s3';
import { isActivePopupImageKey } from '@/lib/services/notices';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!env.S3_UPLOAD_BUCKET) {
    return new Response('Service Unavailable', { status: 503 });
  }

  const raw = new URL(req.url).searchParams.get('key') ?? '';
  const key = raw.replace(/^\/+/, '');
  if (!key || key.includes('..')) {
    return new Response('Not Found', { status: 404 });
  }

  // 활성 팝업 공지가 참조하는 키만 공개 — 임의 객체 읽기 차단.
  if (!(await isActivePopupImageKey(key))) {
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
    // 공개 배너 — 장기 캐시. 키가 매 업로드마다 유니크해 무효화 불필요.
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
    console.error('[api/files/popup] S3 GetObject 실패:', err);
    return new Response('Internal Server Error', { status: 500 });
  }
}
