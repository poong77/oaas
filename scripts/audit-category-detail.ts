import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });
import { connectPg } from '../db/connect';

async function main() {
  const { pool, sql } = connectPg();

  console.log('===== 비활성 분류(web/config) 참조 아티클 =====');
  const arts = await sql<{ slug: string; title: string; product_code: string; category_path: string[] }>`
    SELECT slug, title, product_code, category_path
    FROM articles WHERE is_active = true AND product_code IN ('web','config')
    ORDER BY product_code, title
  `;
  for (const a of arts)
    console.log(`  [${a.product_code}] ${a.title}  ⟶ path: ${JSON.stringify(a.category_path)}`);

  console.log('\n===== 비활성 분류(web/config) 참조 FAQ =====');
  const faqs = await sql<{ question: string; product_code: string; issue_type: string | null }>`
    SELECT question, product_code, issue_type
    FROM faqs WHERE is_active = true AND product_code IN ('web','config')
    ORDER BY product_code
  `;
  for (const f of faqs) console.log(`  [${f.product_code}] ${f.question}`);

  console.log('\n===== 아티클 category_path 첫 두 단계 분포 (product_code별) =====');
  const paths = await sql<{ product_code: string; p1: string; p2: string; n: number }>`
    SELECT product_code, category_path[1] AS p1, category_path[2] AS p2, count(*)::int AS n
    FROM articles WHERE is_active = true
    GROUP BY product_code, category_path[1], category_path[2]
    ORDER BY product_code, n DESC
  `;
  for (const p of paths)
    console.log(`  [${p.product_code}] ${p.p1} > ${p.p2}  (${p.n}건)`);

  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
