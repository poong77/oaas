/**
 * 이메일 본문 이미지 — 에디터 임베드 이미지를 CID 인라인 첨부로 변환.
 *
 * 배경:
 *   에디터 본문 이미지는 `/api/files/view?key=...` **상대 경로 + 로그인 필수** 프록시
 *   URL로 저장된다(비공개 버킷이라 원본 S3 URL은 AccessDenied). 웹 화면에서는 로그인
 *   세션으로 통과하지만, 이 HTML을 그대로 메일로 보내면 수신자(비로그인 외부 클라이언트)는
 *   불러올 수 없어 이미지가 항상 깨진다.
 *
 * 해결 (CID 인라인):
 *   발송 직전 HTML을 스캔하여 `editor/` prefix 이미지를 S3에서 직접 받아 메일 MIME에
 *   **인라인 첨부**(Content-ID)로 동봉하고, 본문 `<img src>`를 `cid:...`로 치환한다.
 *   이미지 바이트가 메일 자체에 포함되므로 인증/도메인/만료에 무관하게 영구 표시된다.
 *
 * S3/자격증명 미설정(개발 stub 등) 시 빈 images로 반환 → 호출부는 Simple 발송으로 폴백.
 */

import { GetObjectCommand } from '@aws-sdk/client-s3';
import { env } from '@/lib/env';
import { getS3Client, isEditorUploadKey } from '@/lib/s3';

export type InlineImage = {
  /** Content-ID (꺾쇠 없는 값). HTML은 `cid:<cid>`, 헤더는 `Content-ID: <<cid>>`. */
  cid: string;
  filename: string;
  contentType: string;
  content: Uint8Array;
};

/**
 * `/api/files/view?key=...` 프록시 URL 매칭.
 * - 상대(`/api/files/view?...`) / 절대(`https://host/api/files/view?...`) 모두 허용.
 * - key 값은 `"`, `'`, 공백, `&`, `)` 직전까지 캡처 (단일 쿼리 파라미터 가정).
 */
const PROXY_URL_RE =
  /(?:https?:\/\/[^/"'\s]+)?\/api\/files\/view\?key=([^"'\s&)]+)/g;

/** contentType → 확장자 (한글 등 비ASCII 파일명 폴백용). */
function extFromContentType(ct: string): string {
  const map: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'image/avif': 'avif',
    'image/bmp': 'bmp',
  };
  return map[ct.toLowerCase()] ?? 'img';
}

/** 키 basename → 안전한 ASCII 파일명. 비ASCII면 `image.<ext>`로 폴백. */
function safeFilename(key: string, index: number, contentType: string): string {
  const base = key.split('/').pop() ?? `image-${index}`;
  if (/^[\x20-\x7E]+$/.test(base) && !base.includes('"')) return base;
  return `image-${index}.${extFromContentType(contentType)}`;
}

/**
 * 메일 HTML에서 에디터 이미지 프록시 URL을 찾아 S3 바이트를 받아 인라인 첨부로 변환.
 *
 * @returns html: `<img src="cid:...">`로 치환된 HTML, images: 동봉할 인라인 이미지 목록.
 *   - 매칭/설정 없음 → { html(원본), images: [] }.
 *   - 같은 key는 한 번만 fetch (cid 재사용).
 *   - 개별 fetch 실패 이미지는 원본 URL 유지(전체 실패 방지), images에서 제외.
 */
export async function extractEditorInlineImages(
  html: string,
): Promise<{ html: string; images: InlineImage[] }> {
  if (!html || !html.includes('/api/files/view')) return { html, images: [] };
  // S3는 EC2 IAM Role을 사용하므로 AWS 키 존재 여부는 체크하지 않는다.
  // 버킷만 미설정이면 스킵.
  if (!env.S3_UPLOAD_BUCKET) {
    return { html, images: [] };
  }

  // 1) 고유 encoded key 수집
  const encodedKeys = new Set<string>();
  for (const m of html.matchAll(PROXY_URL_RE)) encodedKeys.add(m[1]);
  if (encodedKeys.size === 0) return { html, images: [] };

  // 2) key → 인라인 이미지 fetch (병렬, 개별 실패 허용)
  const client = getS3Client();
  const byEncoded = new Map<string, InlineImage>();
  await Promise.all(
    [...encodedKeys].map(async (encoded, index) => {
      let key: string;
      try {
        key = decodeURIComponent(encoded).replace(/^\/+/, '');
      } catch {
        return;
      }
      if (!key || key.includes('..') || !isEditorUploadKey(key)) return;
      try {
        const out = await client.send(
          new GetObjectCommand({ Bucket: env.S3_UPLOAD_BUCKET, Key: key }),
        );
        if (!out.Body) return;
        const content = await out.Body.transformToByteArray();
        const contentType = out.ContentType || 'application/octet-stream';
        const cid = `editimg-${index}@support.oapms.com`;
        byEncoded.set(encoded, {
          cid,
          filename: safeFilename(key, index, contentType),
          contentType,
          content,
        });
      } catch (err) {
        console.error(
          '[email-images] 인라인 이미지 로드 실패 — 원본 URL 유지:',
          key,
          err,
        );
      }
    }),
  );
  if (byEncoded.size === 0) return { html, images: [] };

  // 3) HTML 치환: 성공한 것만 cid로, 실패분은 원본 유지
  const outHtml = html.replace(PROXY_URL_RE, (full, encoded: string) => {
    const img = byEncoded.get(encoded);
    return img ? `cid:${img.cid}` : full;
  });

  return { html: outHtml, images: [...byEncoded.values()] };
}
