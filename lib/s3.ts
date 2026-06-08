/**
 * S3 공유 헬퍼 — 업로드(PutObject)와 인증 프록시 다운로드(GetObject)에서 공용.
 *
 * 버킷(`oaas-uploads-prd`)은 **비공개**다. 원본 S3 URL을 그대로 링크하면 AccessDenied.
 * 첨부 조회는 반드시 `/api/attachments/[id]` 인증 프록시를 통한다.
 *
 * - `getS3Client()` : 자격증명(있으면)으로 구성된 싱글턴 클라이언트.
 * - `resolveS3Object()` : 첨부 메타(pathname/blobUrl)에서 { bucket, key } 도출.
 */

import { S3Client } from '@aws-sdk/client-s3';
import { env } from '@/lib/env';

let s3ClientSingleton: S3Client | null = null;

export function getS3Client(): S3Client {
  if (!s3ClientSingleton) {
    s3ClientSingleton = new S3Client({
      region: env.AWS_REGION || 'ap-northeast-2',
      ...(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
        ? {
            credentials: {
              accessKeyId: env.AWS_ACCESS_KEY_ID,
              secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
            },
          }
        : {}),
    });
  }
  return s3ClientSingleton;
}

/** 업로드 대상 공개 URL 생성 (업로드 응답용). */
export function buildPublicUrl(key: string): string {
  if (env.S3_UPLOAD_PUBLIC_URL) {
    return `${env.S3_UPLOAD_PUBLIC_URL.replace(/\/$/, '')}/${key}`;
  }
  const region = env.AWS_REGION || 'ap-northeast-2';
  return `https://${env.S3_UPLOAD_BUCKET}.s3.${region}.amazonaws.com/${key}`;
}

/**
 * 첨부 레코드(pathname/blobUrl)에서 실제 GetObject 대상 { bucket, key } 도출.
 *
 * - key: `pathname`이 URL이 아니면 그대로(앞 슬래시 제거). URL이거나 비어있으면 `blobUrl`에서 path 추출.
 * - bucket: `S3_UPLOAD_BUCKET` 우선, 없으면 `blobUrl` 호스트(`<bucket>.s3...`)에서 유추.
 *
 * 키/버킷을 못 구하면 null.
 */
export function resolveS3Object(input: {
  pathname?: string | null;
  blobUrl?: string | null;
}): { bucket: string; key: string } | null {
  const { pathname, blobUrl } = input;

  let key: string | null = null;
  if (pathname && !/^https?:\/\//i.test(pathname)) {
    key = pathname.replace(/^\/+/, '');
  } else if (blobUrl) {
    try {
      key = decodeURIComponent(new URL(blobUrl).pathname).replace(/^\/+/, '');
    } catch {
      key = null;
    }
  }
  if (!key) return null;

  let bucket = env.S3_UPLOAD_BUCKET || '';
  if (!bucket && blobUrl) {
    try {
      const host = new URL(blobUrl).hostname; // <bucket>.s3.<region>.amazonaws.com
      const m = host.match(/^([^.]+)\.s3[.-]/i);
      if (m) bucket = m[1];
    } catch {
      /* noop */
    }
  }
  if (!bucket) return null;

  return { bucket, key };
}
