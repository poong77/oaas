/**
 * web/config 비활성 product 분류 → 활성 대분류(pms·etc) 흡수 통합.
 *
 * 배경: 분류 개편으로 product 대분류가 6종(pms/homepage/cms/keyless/kiosk/etc)으로
 *   정리되며 web(웹서비스)·config(설정)이 비활성 처리됐으나, 콘텐츠/메뉴트리가
 *   이전되지 않아 32건이 /help 브라우징에서 숨겨진 상태(비활성 코드 참조).
 *
 * 이전 대상 3테이블 동기:
 *   - menu_taxonomies.product_code  (라벨 트리, 재귀로 서브트리 전체)
 *   - articles.product_code         (category_path[1] 라벨로 타깃 결정)
 *   - faqs.product_code             (개별 매핑)
 *
 * 매핑 (source root 라벨 → target 대분류):
 *   web   "OA 게시판"/"OA 하우스키퍼"/"OA 웹POS" → pms
 *   web   "OA 메시지"/"OA 스마트 TV"             → etc
 *   config "공통설정"/"객실설정"                  → pms
 *   FAQ   web/config 전부                         → etc (계정·문의·메시지 계열)
 *
 * 멱등: 적용 후 재실행 시 web/config 잔여 0 → 변경 0.
 * 실행: dry-run(기본) `npx tsx scripts/remap-web-config.ts`
 *       적용        `npx tsx scripts/remap-web-config.ts --apply`
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });
import { connectPg } from '../db/connect';

const APPLY = process.argv.includes('--apply');

/** menu_taxonomies + articles: (source_code, root_label) → target_code */
const ROOT_MAP: Record<string, string> = {
  'web|OA 게시판': 'pms',
  'web|OA 하우스키퍼': 'pms',
  'web|OA 웹POS': 'pms',
  'web|OA 메시지': 'etc',
  'web|OA 스마트 TV': 'etc',
  'config|공통설정': 'pms',
  'config|객실설정': 'pms',
};

async function main() {
  const { pool, sql } = connectPg();
  console.log(`\n=== web/config 흡수 통합 ${APPLY ? '[APPLY]' : '[DRY-RUN]'} ===\n`);

  // 안전장치: 매핑되지 않은 root 라벨이 있으면 중단 (데이터 변형 방지)
  const srcRoots = await sql<{ product_code: string; label: string }>`
    SELECT product_code, label FROM menu_taxonomies
    WHERE product_code IN ('web','config') AND parent_id IS NULL
  `;
  const unmapped = srcRoots.filter((r) => !(`${r.product_code}|${r.label}` in ROOT_MAP));
  if (unmapped.length) {
    console.error('❌ 매핑 누락 root 라벨:', unmapped.map((r) => `${r.product_code}|${r.label}`));
    await pool.end();
    process.exit(1);
  }

  // ⚠️ connectPg.sql 은 pool.query 기반(매 호출 새 커넥션 가능)이라 BEGIN/COMMIT 트랜잭션
  //    경계가 성립하지 않는다. 각 UPDATE는 자동커밋이며 매핑이 멱등이라 안전.

  // 1. menu_taxonomies: 재귀로 각 노드의 root 라벨 산출 → product_code 갱신.
  //    ⚠️ connectPg의 sql 태그는 "호출 즉시 실행"된다. 절대 미리 변수에 담지 말 것.
  for (const [key, target] of Object.entries(ROOT_MAP)) {
    const [src, rootLabel] = key.split('|');
    if (APPLY) {
      const r = await sql`
        WITH RECURSIVE tree AS (
          SELECT id, parent_id FROM menu_taxonomies
            WHERE product_code = ${src} AND parent_id IS NULL AND label = ${rootLabel}
          UNION ALL
          SELECT m.id, m.parent_id FROM menu_taxonomies m JOIN tree t ON m.parent_id = t.id
        )
        UPDATE menu_taxonomies SET product_code = ${target}, updated_at = now()
          WHERE id IN (SELECT id FROM tree)
        RETURNING id`;
      console.log(`  menu_taxonomies [${src}] "${rootLabel}" → ${target}: ${r.length}노드`);
    } else {
      const r = await sql`
        WITH RECURSIVE tree AS (
          SELECT id, parent_id FROM menu_taxonomies
            WHERE product_code = ${src} AND parent_id IS NULL AND label = ${rootLabel}
          UNION ALL
          SELECT m.id, m.parent_id FROM menu_taxonomies m JOIN tree t ON m.parent_id = t.id
        ) SELECT count(*)::int AS n FROM tree`;
      console.log(`  menu_taxonomies [${src}] "${rootLabel}" → ${target}: ${(r[0] as any).n}노드`);
    }
  }

  // 2. articles: category_path[1] 라벨로 타깃 결정
  console.log('');
  for (const [key, target] of Object.entries(ROOT_MAP)) {
    const [src, rootLabel] = key.split('|');
    if (APPLY) {
      const r = await sql`
        UPDATE articles SET product_code = ${target}, updated_at = now()
          WHERE is_active AND product_code = ${src} AND category_path[1] = ${rootLabel}
        RETURNING id`;
      console.log(`  articles [${src}] "${rootLabel}" → ${target}: ${r.length}건`);
    } else {
      const r = await sql`SELECT count(*)::int AS n FROM articles
        WHERE is_active AND product_code = ${src} AND category_path[1] = ${rootLabel}`;
      console.log(`  articles [${src}] "${rootLabel}" → ${target}: ${(r[0] as any).n}건`);
    }
  }

  // 3. faqs: web/config 전부 etc
  console.log('');
  if (APPLY) {
    const r = await sql`
      UPDATE faqs SET product_code = 'etc', updated_at = now()
        WHERE is_active AND product_code IN ('web','config') RETURNING id`;
    console.log(`  faqs [web/config] → etc: ${r.length}건`);
  } else {
    const r = await sql`SELECT count(*)::int AS n FROM faqs
      WHERE is_active AND product_code IN ('web','config')`;
    console.log(`  faqs [web/config] → etc: ${(r[0] as any).n}건`);
  }

  console.log(APPLY ? '\n✅ 적용 완료' : '\n(dry-run — 변경 없음. 적용하려면 --apply)');

  // 검증: 잔여 web/config 참조
  const leftA = await sql`SELECT count(*)::int AS n FROM articles WHERE is_active AND product_code IN ('web','config')`;
  const leftF = await sql`SELECT count(*)::int AS n FROM faqs WHERE is_active AND product_code IN ('web','config')`;
  const leftM = await sql`SELECT count(*)::int AS n FROM menu_taxonomies WHERE product_code IN ('web','config')`;
  console.log(`\n잔여 참조 — articles:${(leftA[0] as any).n} faqs:${(leftF[0] as any).n} menu_taxonomies:${(leftM[0] as any).n}`);

  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
