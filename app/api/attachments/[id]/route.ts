/**
 * `/api/attachments/[id]` — 티켓 첨부 인증 프록시 (GET).
 *
 * 배경:
 *   - 업로드 버킷(`oaas-uploads-prd`)은 **비공개**. 원본 S3 URL 직접 접근 시 AccessDenied.
 *   - 첨부는 호텔 민감 데이터라 퍼블릭 공개 대신 **로그인 + 티켓 접근 권한 확인 후 스트리밍**.
 *
 * 권한:
 *   - 비로그인 → 401
 *   - 첨부 없음/비활성 → 404
 *   - 해당 티켓에 접근 권한 없음(`getTicketDetail` null) → 404 (존재 은닉)
 *
 * 쿼리:
 *   - `?download=1` → Content-Disposition: attachment (강제 다운로드). 기본은 inline.
 */

import { and, eq } from 'drizzle-orm';
import { GetObjectCommand } from '@aws-sdk/client-s3';

import { db } from '@/db';
import { ticketAttachments } from '@/db/schema';
import { getCurrentUser } from '@/lib/permissions';
import { getTicketDetail } from '@/lib/services/tickets';
import { getS3Client, resolveS3Object } from '@/lib/s3';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/** RFC 5987 filename* 인코딩 (한글/특수문자 안전). */
function contentDisposition(name: string, download: boolean): string {
  const type = download ? 'attachment' : 'inline';
  const fallback = name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  const encoded = encodeURIComponent(name);
  return `${type}; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

export async function GET(req: Request, ctx: Ctx) {
  const user = await getCurrentUser();
  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }
  if (!db) {
    return new Response('Service Unavailable', { status: 503 });
  }

  const { id } = await ctx.params;

  // 첨부 조회 (활성만)
  const rows = await db
    .select()
    .from(ticketAttachments)
    .where(
      and(eq(ticketAttachments.id, id), eq(ticketAttachments.isActive, true)),
    )
    .limit(1);
  const attachment = rows[0];
  if (!attachment) {
    return new Response('Not Found', { status: 404 });
  }

  // 티켓 접근 권한 — getTicketDetail이 호텔리어 소유/호텔 범위까지 검증.
  // 권한 없으면 null → 404로 존재 은닉.
  const ticket = await getTicketDetail(attachment.ticketId, {
    id: user.id,
    role: user.role,
    hotelId: user.hotelId,
  });
  if (!ticket) {
    return new Response('Not Found', { status: 404 });
  }

  const target = resolveS3Object({
    pathname: attachment.pathname,
    blobUrl: attachment.blobUrl,
  });
  if (!target) {
    console.error('[api/attachments] S3 키 도출 실패:', {
      id,
      pathname: attachment.pathname,
    });
    return new Response('Not Found', { status: 404 });
  }

  const download =
    new URL(req.url).searchParams.get('download') === '1';

  try {
    const out = await getS3Client().send(
      new GetObjectCommand({ Bucket: target.bucket, Key: target.key }),
    );
    if (!out.Body) {
      return new Response('Not Found', { status: 404 });
    }

    const webStream = out.Body.transformToWebStream();
    const headers = new Headers();
    headers.set(
      'Content-Type',
      attachment.mimeType || out.ContentType || 'application/octet-stream',
    );
    headers.set(
      'Content-Disposition',
      contentDisposition(attachment.originalName, download),
    );
    if (out.ContentLength != null) {
      headers.set('Content-Length', String(out.ContentLength));
    }
    // 인증 게이트 통과 후이므로 private. 짧게 캐시.
    headers.set('Cache-Control', 'private, max-age=300');

    return new Response(webStream, { status: 200, headers });
  } catch (err) {
    const name = err instanceof Error ? err.name : '';
    if (name === 'NoSuchKey' || name === 'NotFound') {
      return new Response('Not Found', { status: 404 });
    }
    console.error('[api/attachments] S3 GetObject 실패:', err);
    return new Response('Internal Server Error', { status: 500 });
  }
}
