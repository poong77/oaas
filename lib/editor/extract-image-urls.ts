/**
 * 마크다운/HTML에서 이미지 URL 추출.
 *
 * 용도: 본문 저장 시 이전 본문과 비교하여 사라진 이미지 → Vercel Blob delete.
 * (media lifecycle helper)
 *
 * 패턴:
 *   - 마크다운: ![alt](url) 또는 ![alt|width=600](url)
 *   - HTML img: <img src="url" ...>
 *
 * 본 프로젝트 컨텍스트:
 *   - Vercel Blob URL은 보통 `https://*.public.blob.vercel-storage.com/editor/...` 형식
 *   - 외부 URL은 lifecycle 대상에서 제외 (호스팅 영향 0)
 */

const MD_IMAGE_RE = /!\[[^\]]*\]\(([^)]+)\)/g;
const HTML_IMG_RE = /<img\s+[^>]*src=["']([^"']+)["'][^>]*>/gi;

/** 마크다운/HTML 혼합 본문에서 이미지 URL을 모두 추출. 중복 제거. */
export function extractImageUrls(content: string): string[] {
  if (!content) return [];
  const set = new Set<string>();

  for (const m of content.matchAll(MD_IMAGE_RE)) {
    // ![alt|width=600](url) 형식이면 alt 부분에 | 가 있을 수 있고 url은 ()안에만
    const url = m[1].trim();
    if (url) set.add(url);
  }
  for (const m of content.matchAll(HTML_IMG_RE)) {
    const url = m[1].trim();
    if (url) set.add(url);
  }
  return Array.from(set);
}

/** Vercel Blob URL 여부 (CDN 도메인 포함). */
export function isVercelBlobUrl(url: string): boolean {
  return (
    url.includes('.public.blob.vercel-storage.com') ||
    url.includes('.blob.vercel-storage.com')
  );
}

/**
 * 이전 본문 vs 새 본문 비교 → "사라진 이미지" (이전엔 있었으나 새 본문엔 없는 것).
 * Vercel Blob URL만 반환 (외부 이미지는 삭제 대상 아님).
 */
export function diffRemovedImages(oldContent: string, newContent: string): string[] {
  const oldUrls = new Set(extractImageUrls(oldContent).filter(isVercelBlobUrl));
  const newUrls = new Set(extractImageUrls(newContent).filter(isVercelBlobUrl));
  const removed: string[] = [];
  for (const url of oldUrls) {
    if (!newUrls.has(url)) removed.push(url);
  }
  return removed;
}
