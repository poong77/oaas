/**
 * Slack 본문 이미지 — 에디터 임베드 이미지를 presigned S3 URL로 변환 (2026-06-09).
 *
 * 배경:
 *   에디터 본문 이미지는 `/api/files/view?key=...` **상대 경로 + 로그인 필수** 프록시로
 *   저장된다(비공개 버킷). 이 마크다운을 그대로 Slack 메시지에 넣으면 `</api/...|이미지>`
 *   깨진 링크로 표시되고, 절대경로로 바꿔도 Slack 서버는 로그인 게이트를 통과 못 해 못 가져온다.
 *
 * 해결 (presigned URL + image 블록):
 *   발송 직전 본문에서 `editor/` 이미지 키를 추출해 **presigned S3 GET URL**(단기 유효)을 만들고,
 *   Slack `image` 블록의 image_url로 넣는다. Slack은 게시 시점에 그 URL을 한 번 가져와 자체 CDN에
 *   캐시하므로 presign 만료 후에도 표시가 유지된다. (Slack `files:write` 스코프 불필요.)
 *
 * S3/자격증명 미설정(로컬 dev 등) 시 빈 배열 반환 → 호출부는 '이미지 N개' 안내로 폴백.
 */

import 'server-only';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '@/lib/env';
import { getS3Client, isEditorUploadKey, resolveS3Object } from '@/lib/s3';

/** `/api/files/view?key=...`(상대/절대) 프록시 URL에서 key 캡처. */
const PROXY_URL_RE =
  /(?:https?:\/\/[^/"'\s]+)?\/api\/files\/view\?key=([^"'\s&)]+)/g;

/** 본문에서 에디터 이미지 키 목록 추출 (중복 제거, editor/ prefix만). */
export function extractEditorImageKeys(content: string): string[] {
  if (!content || !content.includes('/api/files/view')) return [];
  const keys: string[] = [];
  PROXY_URL_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = PROXY_URL_RE.exec(content))) {
    let key = m[1];
    try {
      key = decodeURIComponent(key);
    } catch {
      /* keep raw */
    }
    if (isEditorUploadKey(key) && !keys.includes(key)) keys.push(key);
  }
  return keys;
}

/** Slack 텍스트용 — 본문에서 에디터 이미지 마크다운 제거 (깨진 링크 방지). */
export function stripEditorImageMarkdown(md: string): string {
  if (!md) return '';
  return md
    // ![alt](/api/files/view?key=...) 또는 절대경로 포함
    .replace(/!\[[^\]]*\]\([^)]*\/api\/files\/view[^)]*\)/g, '')
    // 혹시 마크다운 없이 raw 프록시 URL만 있는 경우
    .replace(/(?:https?:\/\/[^/"'\s]+)?\/api\/files\/view\?key=[^"'\s)]+/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export type SlackImage = { url: string; alt: string };

/** 에디터 이미지 키 → presigned S3 URL 목록 (Slack image 블록용). */
export async function presignSlackImages(
  keys: string[],
  max = 5,
): Promise<SlackImage[]> {
  if (!keys.length || !env.S3_UPLOAD_BUCKET) return [];
  const client = getS3Client();
  const out: SlackImage[] = [];
  for (const key of keys.slice(0, max)) {
    try {
      const url = await getSignedUrl(
        client,
        new GetObjectCommand({ Bucket: env.S3_UPLOAD_BUCKET, Key: key }),
        { expiresIn: 60 * 60 * 24 }, // 24h — Slack은 게시 시 즉시 가져와 캐시
      );
      out.push({ url, alt: key.split('/').pop() ?? '첨부 이미지' });
    } catch {
      // 자격증명/권한 없음 → 이 이미지 건너뜀 (호출부에서 안내 폴백)
    }
  }
  return out;
}

export type AttachmentLite = {
  id: string;
  name: string;
  mimeType: string | null;
  sizeBytes: number;
  pathname: string | null;
  blobUrl: string | null;
};

/** 이미지 타입 첨부 → presigned S3 URL (Slack 인라인 미리보기용). */
export async function presignAttachmentImages(
  attachments: AttachmentLite[],
  max = 5,
): Promise<SlackImage[]> {
  if (!attachments.length || !env.S3_UPLOAD_BUCKET) return [];
  const client = getS3Client();
  const out: SlackImage[] = [];
  for (const a of attachments) {
    if (!a.mimeType || !a.mimeType.startsWith('image/')) continue;
    const obj = resolveS3Object({ pathname: a.pathname, blobUrl: a.blobUrl });
    if (!obj) continue;
    try {
      const url = await getSignedUrl(
        client,
        new GetObjectCommand({ Bucket: obj.bucket, Key: obj.key }),
        { expiresIn: 60 * 60 * 24 },
      );
      out.push({ url, alt: a.name || '첨부 이미지' });
    } catch {
      /* skip */
    }
    if (out.length >= max) break;
  }
  return out;
}
