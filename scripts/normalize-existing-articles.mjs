/**
 * 기존 articles 본문 일괄 정규화.
 *
 * tiptap-markdown 0.9.0 라운드 트립 손상으로 DB에 들어간 본문을
 * normalizeMarkdown() 동일 로직으로 복구.
 *
 * 멱등: 깨끗한 본문은 변경 없음.
 *
 * 사용: node scripts/normalize-existing-articles.mjs
 */
import { config as loadEnv } from 'dotenv';
import { existsSync } from 'node:fs';
loadEnv({ path: '.env' });
if (existsSync('.env.local')) loadEnv({ path: '.env.local', override: true });

import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);

// lib/editor/normalize-markdown.ts와 동일 로직 (mjs라 별도 인라인)
function normalizeMarkdown(md) {
  if (!md) return md;
  return md
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/(!\[[^\]]*\]\([^)]+\))(?=\S)/g, '$1\n\n')
    .replace(/(!\[[^\]]*\]\([^)]+\))\n(?!\n|$)/g, '$1\n\n');
}

const rows = await sql`SELECT id, slug, body_markdown FROM articles`;
let fixed = 0;
let skipped = 0;
for (const row of rows) {
  const clean = normalizeMarkdown(row.body_markdown);
  if (clean === row.body_markdown) {
    skipped++;
    continue;
  }
  await sql`UPDATE articles SET body_markdown = ${clean}, updated_at = NOW() WHERE id = ${row.id}`;
  const diffLen = clean.length - row.body_markdown.length;
  console.log(`[fix] ${row.slug} (${row.body_markdown.length} → ${clean.length}, diff ${diffLen})`);
  fixed++;
}
console.log(`\n✓ 완료: fixed=${fixed}, skipped=${skipped} (이미 깨끗)`);
