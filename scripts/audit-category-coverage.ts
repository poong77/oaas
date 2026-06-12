/**
 * 읽기 전용 점검: 아티클/FAQ가 현재 활성 product 분류 기준에 맞게 정리되어 있는지.
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

import { connectPg } from '../db/connect';

async function main() {
  const { pool, sql } = connectPg();

  // 1. 활성 product 분류 (계층 포함)
  const rows = await sql<{
    id: string; code: string; label: string; parent_id: string | null;
    sort_order: number; is_active: boolean;
  }>`
    SELECT id, code, label, parent_id, sort_order, is_active
    FROM categories WHERE type = 'product'
    ORDER BY is_active DESC, sort_order, label
  `;
  const active = rows.filter((r) => r.is_active);
  const inactive = rows.filter((r) => !r.is_active);
  const activeCodes = new Set(active.map((r) => r.code));
  const inactiveCodes = new Set(inactive.map((r) => r.code));
  const idToCode = new Map(rows.map((r) => [r.id, r.code]));
  const rootActive = active.filter((r) => !r.parent_id);
  const childActive = active.filter((r) => r.parent_id);

  console.log('===== 활성 product 분류 =====');
  console.log(`활성 ${active.length} (대분류 ${rootActive.length} / 하위 ${childActive.length}), 비활성 ${inactive.length}`);
  console.log('\n[활성 대분류(root)]');
  for (const r of rootActive) console.log(`  ${r.code}  ${r.label}`);
  console.log('\n[활성 하위분류(child)]');
  for (const r of childActive)
    console.log(`  ${r.code}  ${r.label}  (parent: ${idToCode.get(r.parent_id!) ?? '??'})`);
  if (inactive.length) {
    console.log('\n[비활성 product 분류]');
    for (const r of inactive) console.log(`  ${r.code}  ${r.label}`);
  }

  const classify = (code: string) =>
    activeCodes.has(code) ? 'OK' : inactiveCodes.has(code) ? 'INACTIVE' : 'UNKNOWN';

  // 2. 아티클 분포
  const artDist = await sql<{ product_code: string | null; status: string; n: number }>`
    SELECT product_code, status, count(*)::int AS n
    FROM articles WHERE is_active = true
    GROUP BY product_code, status ORDER BY product_code, status
  `;
  const artByCode: Record<string, { total: number; published: number; draft: number }> = {};
  for (const r of artDist) {
    const c = r.product_code ?? '(null)';
    artByCode[c] ??= { total: 0, published: 0, draft: 0 };
    artByCode[c].total += r.n;
    if (r.status === 'published') artByCode[c].published += r.n;
    if (r.status === 'draft') artByCode[c].draft += r.n;
  }
  console.log('\n===== 아티클 product_code 분포 (is_active=true) =====');
  for (const [code, v] of Object.entries(artByCode).sort())
    console.log(`  [${classify(code)}] ${code}  총${v.total} (발행${v.published}/초안${v.draft})`);

  // 3. FAQ 분포
  const faqDist = await sql<{ product_code: string | null; n: number }>`
    SELECT product_code, count(*)::int AS n
    FROM faqs WHERE is_active = true
    GROUP BY product_code ORDER BY product_code
  `;
  console.log('\n===== FAQ product_code 분포 (is_active=true) =====');
  for (const r of faqDist) {
    const code = r.product_code ?? '(null)';
    console.log(`  [${classify(code)}] ${code}  ${r.n}건`);
  }

  // 4. 문제 요약
  const badArt = Object.keys(artByCode).filter((c) => classify(c) !== 'OK');
  const faqCodes = faqDist.map((r) => r.product_code ?? '(null)');
  const badFaq = faqCodes.filter((c) => classify(c) !== 'OK');
  console.log('\n===== 문제 요약 =====');
  console.log(`아티클: 비활성/미지정 분류 참조 ${badArt.length}종 → ${badArt.join(', ') || '없음'}`);
  console.log(`FAQ:    비활성/미지정 분류 참조 ${badFaq.length}종 → ${badFaq.join(', ') || '없음'}`);

  // 5. 콘텐츠 0건 활성 분류
  const emptyArt = active.filter((r) => !artByCode[r.code]);
  const faqSet = new Set(faqCodes);
  const emptyFaq = active.filter((r) => !faqSet.has(r.code));
  console.log(`\n활성 분류 중 아티클 0건: ${emptyArt.length}종`);
  for (const r of emptyArt) console.log(`  ${r.code} ${r.label}${r.parent_id ? '' : ' (대분류)'}`);
  console.log(`\n활성 분류 중 FAQ 0건: ${emptyFaq.length}종`);
  for (const r of emptyFaq) console.log(`  ${r.code} ${r.label}${r.parent_id ? '' : ' (대분류)'}`);

  // 6. category_path 깊이
  const ps = (await sql<{ total: number; no_path: number; depth1: number; depth2plus: number }>`
    SELECT count(*)::int AS total,
      count(*) FILTER (WHERE category_path IS NULL OR array_length(category_path,1) IS NULL)::int AS no_path,
      count(*) FILTER (WHERE array_length(category_path,1) = 1)::int AS depth1,
      count(*) FILTER (WHERE array_length(category_path,1) >= 2)::int AS depth2plus
    FROM articles WHERE is_active = true
  `)[0];
  console.log('\n===== 아티클 category_path 깊이 =====');
  console.log(`  총 ${ps.total} / 경로없음 ${ps.no_path} / 1단계 ${ps.depth1} / 2단계+ ${ps.depth2plus}`);

  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
