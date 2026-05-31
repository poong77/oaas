/**
 * Article 미리보기 임시 저장소 (브라우저 localStorage).
 *
 * 새 탭에서 편집 중인(저장 안 된) 본문을 그대로 렌더하기 위해 사용한다.
 * sessionStorage는 window.open() 새 탭으로 전파되지 않으므로 localStorage 사용.
 *
 * - TTL 10분 — 만료된 항목은 read 시 자동 삭제
 * - 키 prefix: `kb-preview:` — 다른 storage 와 충돌 방지
 * - nonce 는 crypto.randomUUID() — URL ?key={nonce} 로 전달
 */

import type { ArticleContentType } from '@/db/schema';

const PREFIX = 'kb-preview:';
const TTL_MS = 10 * 60 * 1000; // 10분

export interface PreviewArticleData {
  productCode: string;
  productLabel: string;
  contentType: ArticleContentType;
  categoryPath: string[];
  title: string;
  slug: string;
  summary: string;
  keywords: string[];
  bodyMarkdown: string;
  authorName: string | null;
  /** 발행 상태 (편집 중인 글이 이미 발행된 글의 수정본인지 표시용) */
  isPublishedSource: boolean;
}

interface StoredPayload {
  data: PreviewArticleData;
  savedAt: number;
}

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

/** 만료된 미리보기 항목 일괄 정리. */
function gc(): void {
  if (!isBrowser()) return;
  const now = Date.now();
  const toDelete: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    if (!k || !k.startsWith(PREFIX)) continue;
    try {
      const raw = window.localStorage.getItem(k);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as StoredPayload;
      if (now - parsed.savedAt > TTL_MS) toDelete.push(k);
    } catch {
      toDelete.push(k);
    }
  }
  toDelete.forEach((k) => window.localStorage.removeItem(k));
}

/**
 * 현재 폼 상태를 임시 저장하고 nonce 반환.
 * 새 탭에서 ?key={nonce} 로 읽는다.
 */
export function savePreview(data: PreviewArticleData): string {
  if (!isBrowser()) {
    throw new Error('savePreview must be called from the browser');
  }
  gc();
  const nonce =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const payload: StoredPayload = { data, savedAt: Date.now() };
  window.localStorage.setItem(PREFIX + nonce, JSON.stringify(payload));
  return nonce;
}

/** nonce 로 저장된 미리보기 데이터 조회. 없거나 만료면 null. */
export function loadPreview(nonce: string): PreviewArticleData | null {
  if (!isBrowser()) return null;
  const raw = window.localStorage.getItem(PREFIX + nonce);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredPayload;
    if (Date.now() - parsed.savedAt > TTL_MS) {
      window.localStorage.removeItem(PREFIX + nonce);
      return null;
    }
    return parsed.data;
  } catch {
    window.localStorage.removeItem(PREFIX + nonce);
    return null;
  }
}

/** 사용 후 명시적 제거 (창 닫을 때 호출). */
export function clearPreview(nonce: string): void {
  if (!isBrowser()) return;
  window.localStorage.removeItem(PREFIX + nonce);
}
