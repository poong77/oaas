/**
 * help.oapms.com 카테고리 이관 직전 1회용 리셋.
 *
 * 동작:
 *   - menu_taxonomies 전체 TRUNCATE (기존 중·소분류 폐기)
 *   - articles 전체 TRUNCATE CASCADE (article_feedback도 연쇄 비움)
 *   - article_seq_counters TRUNCATE (slug 운영 ID 001부터 시작하도록)
 *
 * 사용:
 *   node scripts/reset-help-import.mjs
 *   npm run db:seed                          # 새 메뉴 트리 생성
 *   node scripts/import-help-articles.mjs    # 아티클 이관
 *
 * 초기 세팅 단계용. 운영 데이터 있는 환경에서 실행 금지.
 */
import { config as loadEnv } from 'dotenv';
import { existsSync } from 'node:fs';
import { connectPg } from '../db/connect.mjs';

loadEnv({ path: '.env' });
if (existsSync('.env.local')) loadEnv({ path: '.env.local', override: true });

const url = process.env.DATABASE_URL;
if (!url || url.includes('placeholder')) {
  console.error('DATABASE_URL not set. abort.');
  process.exit(1);
}

const { sql, pool } = connectPg(url);

const menuBefore = await sql`SELECT COUNT(*)::int AS n FROM menu_taxonomies`;
const articleBefore = await sql`SELECT COUNT(*)::int AS n FROM articles`;
const counterBefore = await sql`SELECT COUNT(*)::int AS n FROM article_seq_counters`;
console.log(
  `[before] menu_taxonomies=${menuBefore[0].n}, articles=${articleBefore[0].n}, counters=${counterBefore[0].n}`,
);

await sql`TRUNCATE TABLE menu_taxonomies CASCADE`;
console.log('OK: TRUNCATE menu_taxonomies');

await sql`TRUNCATE TABLE articles CASCADE`;
console.log('OK: TRUNCATE articles (CASCADE → article_feedback)');

await sql`TRUNCATE TABLE article_seq_counters`;
console.log('OK: TRUNCATE article_seq_counters (slug seq 001부터)');

const menuAfter = await sql`SELECT COUNT(*)::int AS n FROM menu_taxonomies`;
const articleAfter = await sql`SELECT COUNT(*)::int AS n FROM articles`;
const counterAfter = await sql`SELECT COUNT(*)::int AS n FROM article_seq_counters`;
console.log(
  `[after]  menu_taxonomies=${menuAfter[0].n}, articles=${articleAfter[0].n}, counters=${counterAfter[0].n}`,
);
console.log('\n다음 단계: npm run db:seed && node scripts/import-help-articles.mjs');
await pool.end();
