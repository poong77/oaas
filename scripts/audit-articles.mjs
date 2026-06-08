/**
 * 아티클 자동 검수 — body-validator.ts 규칙으로 issue 사전 발견.
 *
 * 검수 항목:
 *   - content_type별 필수 H2 4종 누락 (warnings)
 *   - slug 형식 (^[a-z0-9]+(-[a-z0-9]+)*$)
 *   - title 길이 (2~60자)
 *   - summary 길이 (≤200자 권장)
 *   - keywords 갯수 (1~30, ≤5 권장)
 *   - 본문 실질 길이 (≥50자, ≥300자 권장)
 *   - 이미지 부재 (시각 자료 없음)
 *
 * 사용: node scripts/audit-articles.mjs [productCode]
 *       node scripts/audit-articles.mjs pms
 */
import { config as loadEnv } from 'dotenv';
import { existsSync } from 'node:fs';
loadEnv({ path: '.env' });
if (existsSync('.env.local')) loadEnv({ path: '.env.local', override: true });

import { connectPg } from '../db/connect.mjs';
const { sql, pool } = connectPg(process.env.DATABASE_URL);

const productCode = process.argv[2] || 'pms';

// body-validator.ts와 동일 규칙
const REQUIRED_H2 = {
  howto: ['목표', '사전 준비', '단계', '다음 단계'],
  feature: ['개요', '위치(메뉴 경로)', '항목 설명', '관련 문서'],
  troubleshoot: ['증상', '원인', '해결 단계', '그래도 안 되면'],
};
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function checkH2(body, contentType) {
  const required = REQUIRED_H2[contentType] || [];
  const missing = [];
  const h2Headings = [...body.matchAll(/^##\s+(.+)$/gm)].map((m) => m[1].trim());
  for (const req of required) {
    const core = req.split('(')[0].trim();
    if (!h2Headings.some((h) => h.includes(core))) missing.push(req);
  }
  return missing;
}

function countImages(body) {
  return (body.match(/!\[[^\]]*\]\([^)]+\)/g) || []).length;
}

function realContentLength(body) {
  return body
    .split('\n')
    .filter((l) => {
      const t = l.trim();
      if (!t) return false;
      if (t.startsWith('#')) return false;
      if (t.startsWith('>')) return false;
      return true;
    })
    .join(' ')
    .trim().length;
}

const articles = await sql`
  SELECT slug, content_type, status, title, summary, keywords, category_path,
         body_markdown, is_active
  FROM articles
  WHERE product_code = ${productCode}
  ORDER BY slug
`;

console.log(`\n=== ${productCode.toUpperCase()} 아티클 자동 검수 (${articles.length}건) ===\n`);

const summary = { clean: 0, warn: 0, error: 0 };
const reports = [];

for (const a of articles) {
  const issues = { error: [], warn: [], info: [] };

  if (!SLUG_PATTERN.test(a.slug)) issues.error.push(`slug 형식 오류`);
  if (a.title.length < 2 || a.title.length > 60) issues.error.push(`title 길이 (${a.title.length}자)`);
  const missing = checkH2(a.body_markdown, a.content_type);
  if (missing.length > 0) issues.warn.push(`필수 H2 누락: ${missing.join(', ')}`);
  const sumLen = (a.summary || '').length;
  if (sumLen === 0) issues.warn.push(`summary 비어있음`);
  else if (sumLen > 200) issues.warn.push(`summary 200자 초과 (${sumLen})`);
  const kwCount = (a.keywords || []).length;
  if (kwCount === 0) issues.error.push(`keywords 0개`);
  else if (kwCount > 5) issues.info.push(`keywords ${kwCount}개 (사용자 권장 ≤5)`);
  const real = realContentLength(a.body_markdown);
  if (real < 50) issues.error.push(`본문 실질 ${real}자 (<50)`);
  else if (real < 300) issues.info.push(`본문 짧음 ${real}자`);
  const imgs = countImages(a.body_markdown);
  if (imgs === 0) issues.info.push(`이미지 0장`);

  const level = issues.error.length ? 'error' : issues.warn.length ? 'warn' : 'clean';
  summary[level === 'clean' ? 'clean' : level === 'warn' ? 'warn' : 'error']++;

  if (issues.error.length || issues.warn.length || issues.info.length) {
    reports.push({ slug: a.slug, level, title: a.title, ...issues });
  }
}

// 출력: error → warn → info 순으로
const errors = reports.filter((r) => r.level === 'error');
const warns = reports.filter((r) => r.level === 'warn');
const cleanInfos = reports.filter((r) => r.level === 'clean' && r.info?.length);

if (errors.length) {
  console.log(`🔴 ERROR (${errors.length}건) — 발행 차단 가능성`);
  for (const r of errors) {
    console.log(`\n  ${r.slug} — ${r.title}`);
    r.error.forEach((m) => console.log(`    ✗ ${m}`));
    r.warn.forEach((m) => console.log(`    ⚠ ${m}`));
  }
}

if (warns.length) {
  console.log(`\n🟡 WARN (${warns.length}건) — 발행은 가능, 보완 권장`);
  for (const r of warns) {
    console.log(`\n  ${r.slug} — ${r.title}`);
    r.warn.forEach((m) => console.log(`    ⚠ ${m}`));
  }
}

if (cleanInfos.length) {
  console.log(`\n🔵 INFO (${cleanInfos.length}건) — 권장사항 (필수 아님)`);
  for (const r of cleanInfos) {
    console.log(`  ${r.slug}: ${r.info.join(', ')}`);
  }
}

console.log(`\n=== 요약 ===`);
console.log(`  🟢 깨끗:  ${summary.clean}`);
console.log(`  🟡 워닝:  ${summary.warn}`);
console.log(`  🔴 에러:  ${summary.error}`);
console.log(`  📊 합계:  ${articles.length}`);
await pool.end();
