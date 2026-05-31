/**
 * 아티클 Slug 운영 ID 채번 (A7) — 서버 전용.
 *
 * 형식: `{productCode}-{contentType}-{seq3}`
 *   - productCode: 'pms', 'cms', 'keyless', 'kiosk', 'web' 등 (소문자, 하이픈/숫자만 허용)
 *   - contentType: 'howto' | 'feature' | 'troubleshoot'
 *   - seq3: 3자리 zero-padding (001~999, 999+는 4자리로 자동 확장)
 *
 * 예시: `pms-howto-042`, `cms-troubleshoot-013`, `keyless-feature-007`
 *
 * 채번:
 *   - `article_seq_counters` atomic UPSERT 패턴 (ticket-no-counter와 동일)
 *   - INSERT ... ON CONFLICT (product_code, content_type) DO UPDATE
 *     SET last_seq = article_seq_counters.last_seq + 1 RETURNING last_seq
 *   - race-free (Neon replica lag 무관)
 *
 * 호환:
 *   - 기존 발행 아티클 slug는 그대로 유지 (마이그레이션 없음)
 *   - 신규 작성은 본 운영 ID 강제 (article-actions.generateArticleSlug에서 호출)
 *
 * @see docs/02-design/knowledge-base-overhaul/PLAN.md §12-1
 */

import 'server-only';
import { sql } from 'drizzle-orm';

import { db } from '@/db';
import { articleSeqCounters } from '@/db/schema';
import type { ArticleContentType } from '@/db/schema';

/** productCode 정규화: 소문자 + 하이픈/숫자만 허용. */
export function normalizeProductCode(code: string): string {
  return code
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function padSeq(n: number): string {
  return n < 1000 ? n.toString().padStart(3, '0') : n.toString();
}

/**
 * 운영 ID slug 채번 — atomic UPSERT.
 *
 * @example
 * await generateOpsIdSlug('pms', 'howto')
 *   // → { slug: 'pms-howto-042', seq: 42, productCode: 'pms' }
 */
export async function generateOpsIdSlug(
  productCode: string,
  contentType: ArticleContentType,
): Promise<{ slug: string; seq: number; productCode: string }> {
  const pc = normalizeProductCode(productCode);
  if (!pc) throw new Error('Invalid productCode');
  if (!db) throw new Error('DB not ready');

  // Atomic UPSERT: 행 없으면 last_seq=1로 INSERT, 있으면 +1
  const rows = await db
    .insert(articleSeqCounters)
    .values({ productCode: pc, contentType, lastSeq: 1 })
    .onConflictDoUpdate({
      target: [articleSeqCounters.productCode, articleSeqCounters.contentType],
      set: { lastSeq: sql`${articleSeqCounters.lastSeq} + 1` },
    })
    .returning({ lastSeq: articleSeqCounters.lastSeq });

  const seq = rows[0]?.lastSeq ?? 1;
  return {
    slug: `${pc}-${contentType}-${padSeq(seq)}`,
    seq,
    productCode: pc,
  };
}

/**
 * 운영 ID slug 형식 검증 (UI 표시용).
 *
 * `{lower}-{howto|feature|troubleshoot}-{digits3+}` 패턴.
 */
export function isOpsIdSlug(slug: string): boolean {
  return /^[a-z0-9-]+-(howto|feature|troubleshoot)-\d{3,}$/.test(slug);
}

/** slug에서 (productCode, contentType, seq) 파싱. 형식 불일치 시 null. */
export function parseOpsIdSlug(
  slug: string,
): { productCode: string; contentType: ArticleContentType; seq: number } | null {
  const m = slug.match(
    /^([a-z0-9-]+)-(howto|feature|troubleshoot)-(\d{3,})$/,
  );
  if (!m) return null;
  return {
    productCode: m[1]!,
    contentType: m[2]! as ArticleContentType,
    seq: parseInt(m[3]!, 10),
  };
}
