import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });
import { connectPg } from '../db/connect';

async function main() {
  const { pool, sql } = connectPg();

  console.log('===== menu_taxonomies product_code 분포 =====');
  const dist = await sql<{ product_code: string; n: number; roots: number; active: number }>`
    SELECT product_code,
      count(*)::int AS n,
      count(*) FILTER (WHERE parent_id IS NULL)::int AS roots,
      count(*) FILTER (WHERE is_active)::int AS active
    FROM menu_taxonomies GROUP BY product_code ORDER BY product_code
  `;
  for (const d of dist)
    console.log(`  ${d.product_code}  총${d.n} (root ${d.roots}, 활성 ${d.active})`);

  console.log('\n===== web/config menu_taxonomies root 노드 =====');
  const roots = await sql<{ product_code: string; label: string; is_active: boolean }>`
    SELECT product_code, label, is_active FROM menu_taxonomies
    WHERE product_code IN ('web','config') AND parent_id IS NULL
    ORDER BY product_code, sort_order, label
  `;
  for (const r of roots) console.log(`  [${r.product_code}] ${r.label} ${r.is_active ? '' : '(비활성)'}`);

  // 아티클 category_path[1] 라벨 ↔ menu_taxonomies 매칭 여부 (web/config)
  console.log('\n===== web/config 아티클 category_path[1] 이 어느 product의 menu_taxonomy에 존재? =====');
  const check = await sql<{ product_code: string; p1: string; in_same: number; in_pms: number; in_etc: number }>`
    WITH a AS (
      SELECT DISTINCT product_code, category_path[1] AS p1
      FROM articles WHERE is_active AND product_code IN ('web','config')
    )
    SELECT a.product_code, a.p1,
      (SELECT count(*) FROM menu_taxonomies m WHERE m.product_code=a.product_code AND m.label=a.p1)::int AS in_same,
      (SELECT count(*) FROM menu_taxonomies m WHERE m.product_code='pms' AND m.label=a.p1)::int AS in_pms,
      (SELECT count(*) FROM menu_taxonomies m WHERE m.product_code='etc' AND m.label=a.p1)::int AS in_etc
    FROM a ORDER BY a.product_code, a.p1
  `;
  for (const c of check)
    console.log(`  [${c.product_code}] "${c.p1}"  →  same:${c.in_same} pms:${c.in_pms} etc:${c.in_etc}`);

  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
