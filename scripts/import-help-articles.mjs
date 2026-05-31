/**
 * help.oapms.com → 통합AS articles 이관 — PMS 객실관리 13건 (실시간 객실 3건 idempotent skip + 신규 10건).
 *
 * 흐름:
 *   1) sources[]의 모든 이미지를 fetch → sharp+SVG composite로 브라우저 프레임
 *      + sunset 배경 입힘 → Vercel Blob에 같은 path로 업로드 (allowOverwrite).
 *   2) specs[]의 각 article에 대해:
 *      - (productCode, title) 존재하면 skip — 이미지 frame은 (1)에서 갱신됐으니
 *        본문 안 BLOB URL은 그대로 유효.
 *      - 신규면 generateOpsIdSlug atomic 채번 → status='draft' insert.
 *
 * 멱등성:
 *   - 이미지: allowOverwrite=true로 같은 path 덮어쓰기
 *   - article: title 기준 skip
 *   - counter: 신규 article 생성 시에만 +1
 *
 * 사용:
 *   node scripts/import-help-articles.mjs
 */
import { config as loadEnv } from 'dotenv';
import { existsSync } from 'node:fs';
import { put } from '@vercel/blob';
import { neon } from '@neondatabase/serverless';

loadEnv({ path: '.env' });
if (existsSync('.env.local')) loadEnv({ path: '.env.local', override: true });

import { compositeBrowserFrame } from './lib/composite-frame.mjs';
import { sources as sourcesPmsRoom, specs as specsPmsRoom } from './data/help-pms-specs.mjs';
import { sources as sourcesPmsRoomExtra, specs as specsPmsRoomExtra } from './data/help-pms-room-extra-specs.mjs';
import { sources as sourcesPmsCDR, specs as specsPmsCDR } from './data/help-pms-customer-daily-report-specs.mjs';
import { sources as sourcesCms, specs as specsCms } from './data/help-cms-specs.mjs';

// 모든 spec 파일을 합쳐서 한 번에 처리. 신규 카테고리 추가 시 여기에 import + concat.
const sources = [...sourcesPmsRoom, ...sourcesPmsRoomExtra, ...sourcesPmsCDR, ...sourcesCms];
const specs = [...specsPmsRoom, ...specsPmsRoomExtra, ...specsPmsCDR, ...specsCms];

const dbUrl = process.env.DATABASE_URL;
const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
if (!dbUrl || dbUrl.includes('placeholder')) {
  console.error('DATABASE_URL not set. abort.');
  process.exit(1);
}
if (!blobToken) {
  console.error('BLOB_READ_WRITE_TOKEN not set. abort.');
  process.exit(1);
}

const sql = neon(dbUrl);

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

async function fetchAndFrame(srcUrl, dstPath) {
  const res = await fetch(srcUrl);
  if (!res.ok) throw new Error(`fetch ${srcUrl} → ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const framed = await compositeBrowserFrame(buf);
  const blob = await put(dstPath, framed, {
    access: 'public',
    contentType: 'image/png',
    addRandomSuffix: false,
    allowOverwrite: true,
    token: blobToken,
  });
  return { url: blob.url, originalBytes: buf.length, framedBytes: framed.length };
}

function extractToc(markdown) {
  const entries = [];
  let inCodeBlock = false;
  for (const raw of markdown.split('\n')) {
    const line = raw.trim();
    if (line.startsWith('```')) { inCodeBlock = !inCodeBlock; continue; }
    if (inCodeBlock) continue;
    const m = /^(#{1,3})\s+(.+?)\s*$/.exec(line);
    if (!m) continue;
    const level = m[1].length;
    const text = m[2].replace(/[*_`~]/g, '').trim();
    if (!text) continue;
    const anchor =
      text
        .toLowerCase()
        .replace(/[^\wㄱ-힝\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .slice(0, 80) || `h-${Math.random().toString(36).slice(2, 8)}`;
    entries.push({ level, text, anchor });
  }
  return entries;
}

async function generateOpsIdSlug(productCode, contentType) {
  const rows = await sql`
    INSERT INTO article_seq_counters (product_code, content_type, last_seq)
    VALUES (${productCode}, ${contentType}, 1)
    ON CONFLICT (product_code, content_type)
    DO UPDATE SET last_seq = article_seq_counters.last_seq + 1
    RETURNING last_seq
  `;
  const seq = rows[0].last_seq;
  const seqStr = seq < 1000 ? String(seq).padStart(3, '0') : String(seq);
  return `${productCode}-${contentType}-${seqStr}`;
}

async function insertArticle(spec, body, authorId) {
  const existing = await sql`
    SELECT id, slug FROM articles
    WHERE product_code = ${spec.productCode} AND title = ${spec.title}
    LIMIT 1
  `;
  if (existing.length > 0) {
    return { ok: false, skipped: true, slug: existing[0].slug };
  }
  const slug = await generateOpsIdSlug(spec.productCode, spec.contentType);
  const toc = extractToc(body);
  await sql`
    INSERT INTO articles (
      product_code, content_type, status, category_path,
      slug, title, summary, summary_30s, keywords,
      body_markdown, toc, author_id, last_editor_id,
      published_at, related_slugs
    ) VALUES (
      ${spec.productCode}, ${spec.contentType}, 'draft', ${spec.categoryPath},
      ${slug}, ${spec.title}, ${spec.summary}, ${spec.summary}, ${spec.keywords},
      ${body}, ${JSON.stringify(toc)}::jsonb, ${authorId}, ${authorId},
      NULL, '{}'::text[]
    )
  `;
  return { ok: true, slug };
}

// ─────────────────────────────────────────────────────────────
// 0. 사전 점검
// ─────────────────────────────────────────────────────────────

const [manager] = await sql`
  SELECT id FROM users WHERE email = 'manager@oa.local' LIMIT 1
`;
const authorId = manager?.id ?? null;
if (!authorId) {
  console.error('❌ manager@oa.local 사용자가 없습니다. `npm run db:seed` 먼저.');
  process.exit(1);
}
console.log(`✓ author: manager@oa.local`);

// 메뉴 트리 확인 (PMS 객실관리 하위 6개 소분류 존재)
const menuCheck = await sql`
  SELECT label FROM menu_taxonomies
  WHERE product_code = 'pms'
    AND label IN ('실시간 객실(오늘)','객실현황(이달)','예약등록','예약조회','예약 캘린더','체크인/아웃')
`;
const found = new Set(menuCheck.map((r) => r.label));
const needed = ['실시간 객실(오늘)','객실현황(이달)','예약등록','예약조회','예약 캘린더','체크인/아웃'];
const missing = needed.filter((n) => !found.has(n));
if (missing.length > 0) {
  console.error(`❌ menu_taxonomies 누락: ${missing.join(', ')}. \`npm run db:seed\` 필요.`);
  process.exit(1);
}
console.log(`✓ menu_taxonomies 트리 확인 (객실관리 하위 ${needed.length}건)`);

// ─────────────────────────────────────────────────────────────
// 1. 이미지 합성·업로드 (sources 전부)
// ─────────────────────────────────────────────────────────────

console.log(`\n[1/2] 이미지 합성·업로드 — ${sources.length}개 source / 총 ${sources.reduce((s, x) => s + x.imgs.length, 0)}장`);

const sourceImages = {}; // { [hash]: [url, url, ...] }
for (const src of sources) {
  console.log(`\n  source ${src.hash} (${src.label}) — ${src.imgs.length}장`);
  sourceImages[src.hash] = [];
  for (let idx = 0; idx < src.imgs.length; idx++) {
    const dstPath = `articles/source/${src.hash}/${String(idx + 1).padStart(2, '0')}.png`;
    try {
      const { url, originalBytes, framedBytes } = await fetchAndFrame(src.imgs[idx], dstPath);
      sourceImages[src.hash].push(url);
      console.log(`    [${idx + 1}/${src.imgs.length}] ${originalBytes}→${framedBytes} bytes — ${url.split('/').slice(-2).join('/')}`);
    } catch (err) {
      console.error(`    [${idx + 1}/${src.imgs.length}] FAIL: ${err.message}`);
      sourceImages[src.hash].push(null); // null로 두면 buildBody가 ${undefined} 출력
    }
  }
}

// ─────────────────────────────────────────────────────────────
// 2. 아티클 insert (specs 13건)
// ─────────────────────────────────────────────────────────────

console.log(`\n[2/2] 아티클 insert — ${specs.length}건 spec`);
let created = 0;
let skipped = 0;
let failed = 0;
for (const spec of specs) {
  const imgs = sourceImages[spec.sourceHash];
  if (!imgs) {
    console.error(`  [fail] sourceHash=${spec.sourceHash} 이미지 없음: ${spec.title}`);
    failed++;
    continue;
  }
  const body = spec.buildBody(imgs);
  try {
    const r = await insertArticle(spec, body, authorId);
    if (r.ok) {
      console.log(`  [create] ${r.slug} — "${spec.title}"`);
      created++;
    } else if (r.skipped) {
      console.log(`  [skip]   ${r.slug} — "${spec.title}" (이미 존재)`);
      skipped++;
    }
  } catch (err) {
    console.error(`  [fail]   "${spec.title}" — ${err.message}`);
    failed++;
  }
}

console.log(`\n✓ 완료: created=${created}, skipped=${skipped}, failed=${failed}`);
console.log('  확인 → /admin/articles (draft 필터)');
