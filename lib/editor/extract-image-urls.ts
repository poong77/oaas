/**
 * 마크다운/HTML에서 이미지 URL 추출.
 *
 * 용도: 본문 저장 시 이전 본문과 비교하여 사라진 이미지 → S3 delete.
 * (media lifecycle helper)
 *
 * 패턴:
 *   - 마크다운: ![alt](url) 또는 ![alt|width=600](url)
 *   - HTML img: <img src="url" ...>
 *
 * 본 프로젝트 컨텍스트:
 *   - 자체 S3/CloudFront URL은 `S3_UPLOAD_PUBLIC_URL` 또는 버킷 가상호스팅 URL 형식.
 *   - 외부 URL은 lifecycle 대상에서 제외 (호스팅 영향 0).
 */

import { env } from '@/lib/env';

const MD_IMAGE_RE = /!\[[^\]]*\]\(([^)]+)\)/g;
const HTML_IMG_RE = /<img\s+[^>]*src=["']([^"']+)["'][^>]*>/gi;

/** 마크다운/HTML 혼합 본문에서 이미지 URL을 모두 추출. 중복 제거. */
export function extractImageUrls(content: string): string[] {
  if (!content) return [];
  const set = new Set<string>();

  for (const m of content.matchAll(MD_IMAGE_RE)) {
    const url = m[1].trim();
    if (url) set.add(url);
  }
  for (const m of content.matchAll(HTML_IMG_RE)) {
    const url = m[1].trim();
    if (url) set.add(url);
  }
  return Array.from(set);
}

/**
 * 우리가 호스팅하는 첨부 URL 여부.
 *   - `S3_UPLOAD_PUBLIC_URL` (CloudFront 등) 이 설정되어 있으면 그 prefix
 *   - 그 외에는 `{S3_UPLOAD_BUCKET}.s3.{REGION}.amazonaws.com` 가상호스팅 패턴
 */
export function isOwnedUploadUrl(url: string): boolean {
  const publicBase = env.S3_UPLOAD_PUBLIC_URL.replace(/\/$/, '');
  if (publicBase && url.startsWith(publicBase + '/')) return true;

  const bucket = env.S3_UPLOAD_BUCKET;
  if (!bucket) return false;
  // 가상호스팅: https://{bucket}.s3.{region}.amazonaws.com/...
  // 경로기반:   https://s3.{region}.amazonaws.com/{bucket}/...
  if (url.includes(`//${bucket}.s3.`)) return true;
  if (url.includes(`/s3.`) && url.includes(`/${bucket}/`)) return true;
  return false;
}

/**
 * 이전 본문 vs 새 본문 비교 → "사라진 이미지" (이전엔 있었으나 새 본문엔 없는 것).
 * 자체 호스팅 URL만 반환 (외부 이미지는 삭제 대상 아님).
 */
export function diffRemovedImages(oldContent: string, newContent: string): string[] {
  const oldUrls = new Set(extractImageUrls(oldContent).filter(isOwnedUploadUrl));
  const newUrls = new Set(extractImageUrls(newContent).filter(isOwnedUploadUrl));
  const removed: string[] = [];
  for (const url of oldUrls) {
    if (!newUrls.has(url)) removed.push(url);
  }
  return removed;
}
