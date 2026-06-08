/**
 * 제품 분류 계층(대/중/소) 시드 — major-overhaul P5.
 *
 * - categories(type='product')에 parent_id/memo 기반 3계층 트리를 upsert.
 * - 기존 대분류 코드(pms/cms/keyless/kiosk)는 보존(기존 티켓 호환). label/sort만 갱신.
 * - 멱등: (type,code) 유니크로 ON CONFLICT 업서트. 기존 비계층 코드(web/config 등)는 건드리지 않음.
 * - parent_id 컬럼이 없으면 먼저 추가(ADD COLUMN IF NOT EXISTS).
 *
 * 실행: npx tsx --env-file=.env.local db/seed-product-taxonomy.ts
 */

import { Pool } from 'pg';

type Node = { code: string; label: string; memo?: string; children?: Node[] };

const TAXONOMY: Node[] = [
  {
    code: 'pms',
    label: 'PMS',
    children: [
      {
        code: 'pms_pms',
        label: 'PMS',
        children: [
          { code: 'pms_pms_ver', label: 'ver' },
          { code: 'pms_pms_installed', label: '설치형' },
          { code: 'pms_pms_web', label: '웹' },
        ],
      },
      { code: 'pms_webpos', label: 'WebPOS', memo: '웹포스' },
      { code: 'pms_housekeeper', label: 'Housekeeper' },
    ],
  },
  {
    code: 'homepage',
    label: '홈페이지',
    children: [
      { code: 'hp_homepage', label: '홈페이지' },
      { code: 'hp_booking', label: '부킹엔진' },
    ],
  },
  {
    code: 'cms',
    label: 'CMS',
    children: [
      { code: 'cms_hg', label: 'HG CMS' },
      { code: 'cms_tll', label: 'TLL CMS' },
      { code: 'cms_oa', label: 'OA CMS', memo: '야여 크롤링' },
    ],
  },
  {
    code: 'keyless',
    label: 'Keyless',
    children: [
      {
        code: 'kl_doorlock',
        label: '도어락',
        children: [
          { code: 'kl_doorlock_buildone', label: '빌드원' },
          { code: 'kl_doorlock_hione', label: '하이원' },
          { code: 'kl_doorlock_module', label: '모듈ver' },
        ],
      },
      {
        code: 'kl_mobilekey',
        label: '모바일키',
        children: [
          { code: 'kl_mobilekey_wifi', label: '와이파이' },
          { code: 'kl_mobilekey_ble', label: '블루투스' },
          { code: 'kl_mobilekey_ver', label: 'ver' },
        ],
      },
      { code: 'kl_keyless', label: 'Keyless', memo: '키발급' },
      {
        code: 'kl_relay',
        label: '릴레이보드',
        memo: '도어락 + 보드, 도어락/보드',
        children: [
          { code: 'kl_relay_4', label: '4구' },
          { code: 'kl_relay_1', label: '1구' },
        ],
      },
    ],
  },
  {
    code: 'kiosk',
    label: 'Kiosk',
    children: [
      {
        code: 'kiosk_kiosk',
        label: '키오스크',
        children: [
          { code: 'kiosk_v1', label: 'V1' },
          { code: 'kiosk_v2', label: 'V2' },
        ],
      },
    ],
  },
  {
    code: 'etc',
    label: '기타',
    children: [
      { code: 'etc_general', label: '일반', memo: '문의 디폴트값' },
      { code: 'etc_message', label: '메시지', memo: '문자, 알림톡' },
      { code: 'etc_alimtalk', label: '알림톡', memo: '챗봇' },
      { code: 'etc_hoteltv', label: 'Hotel TV' },
      { code: 'etc_parking', label: '주차연동' },
      { code: 'etc_rms', label: 'RMS연동' },
      {
        code: 'etc_pgvan',
        label: 'PG/VAN',
        memo: 'PG, VAN, POS',
        children: [{ code: 'etc_pgvan_payment', label: 'Payment API' }],
      },
    ],
  },
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL 없음');
  const pool = new Pool({
    connectionString: url,
    ssl: url.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
  });

  const dbn = await pool.query('select current_database() db');
  console.log('대상 DB:', dbn.rows[0].db);

  // 1) 컬럼 보장
  await pool.query(
    `ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "parent_id" uuid`,
  );
  await pool.query(
    `ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "memo" text`,
  );

  let sort = 0;
  let count = 0;

  async function upsert(
    node: Node,
    parentId: string | null,
  ): Promise<void> {
    sort += 1;
    const res = await pool.query(
      `INSERT INTO "categories" (type, code, label, sort_order, parent_id, memo, is_active)
       VALUES ('product', $1, $2, $3, $4, $5, true)
       ON CONFLICT (type, code) DO UPDATE
         SET label = EXCLUDED.label,
             sort_order = EXCLUDED.sort_order,
             parent_id = EXCLUDED.parent_id,
             memo = EXCLUDED.memo,
             is_active = true,
             updated_at = now()
       RETURNING id`,
      [node.code, node.label, sort * 10, parentId, node.memo ?? null],
    );
    const id = res.rows[0].id as string;
    count += 1;
    for (const child of node.children ?? []) {
      await upsert(child, id);
    }
  }

  for (const root of TAXONOMY) {
    await upsert(root, null);
  }

  console.log(`✅ 제품 분류 ${count}개 upsert 완료`);

  // 결과 요약 (대분류별 자식 수)
  const summary = await pool.query(
    `SELECT p.label AS root, count(c.id)::int AS children
     FROM categories p
     LEFT JOIN categories c ON c.parent_id = p.id AND c.type='product'
     WHERE p.type='product' AND p.parent_id IS NULL
     GROUP BY p.label ORDER BY min(p.sort_order)`,
  );
  console.log('대분류:', JSON.stringify(summary.rows));

  await pool.end();
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('❌', e?.message || e);
    process.exit(1);
  });
