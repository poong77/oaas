/**
 * Vercel Blob 본문 이미지 → S3 이관 (자체 호스팅 이전 잔여 작업).
 *
 * 배경:
 *   - 과거 Vercel 시절 아티클·공지 본문 이미지는 `*.public.blob.vercel-storage.com`
 *     URL을 마크다운에 직접 박아두었다.
 *   - 자체 호스팅 이전 후 CSP `img-src`에 vercel-storage 도메인이 없어 브라우저가
 *     차단 → 운영에서 이미지가 깨짐. (이미지 소스 자체는 아직 살아있음)
 *
 * 전략 (서버 SSH 없이 로컬에서 실행 가능):
 *   1. 운영 DB에서 vercel-blob URL을 가진 articles/notices 본문을 읽는다.
 *   2. 각 고유 이미지 URL의 바이트를 내려받아,
 *   3. 배포된 `/api/upload`(purpose=editor)로 인증 POST → 서버 IAM Role이 S3에 PUT,
 *      `/api/files/view?key=...` 프록시 URL을 돌려준다. (sharp 최적화·키 생성 재사용)
 *   4. 본문의 옛 URL을 프록시 URL로 치환하고 DB를 UPDATE한다.
 *
 * 멱등성:
 *   - 재실행 시 이미 치환된 본문엔 vercel-blob URL이 없어 건너뛴다.
 *   - 한 번 실행 내에서 동일 이미지 URL은 1회만 업로드(맵 캐시).
 *   - 업로드 실패한 URL이 남은 레코드는 변경하지 않는다(부분 성공 안전).
 *
 * 환경변수:
 *   - DATABASE_URL        : 운영 DB (.env.local에 설정됨)
 *   - SUPPORT_COOKIE      : 로그인된 support.oapms.com 브라우저의 Cookie 헤더 전체 문자열
 *   - BASE_URL            : 기본 https://support.oapms.com
 *   - APPLY=1             : 실제 업로드 + DB 쓰기 (미설정 시 dry-run: 대상만 집계)
 *   - ONLY=articles|notices : 한 테이블만 처리 (선택)
 *
 * 실행:
 *   dry-run:  SUPPORT_COOKIE='...' npx tsx -r dotenv/config db/migrate-vercel-blob-images.ts dotenv_config_path=.env.local
 *   적용:     APPLY=1 SUPPORT_COOKIE='...' npx tsx -r dotenv/config db/migrate-vercel-blob-images.ts dotenv_config_path=.env.local
 */

import { writeFileSync } from 'node:fs';
import { connectPg } from './connect';

const DATABASE_URL = process.env.DATABASE_URL;
const COOKIE = process.env.SUPPORT_COOKIE ?? '';
const BASE_URL = (process.env.BASE_URL ?? 'https://support.oapms.com').replace(/\/$/, '');
const APPLY = process.env.APPLY === '1';
const ONLY = process.env.ONLY as 'articles' | 'notices' | undefined;

/** vercel blob 공개 URL 패턴 (delimiter 제외 문자만 캡처). */
const VERCEL_BLOB_RE =
  /https?:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\/[^\s)"'<>\\]+/gi;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Target = { table: 'articles' | 'notices'; id: string; label: string; body: string };

function basenameFromUrl(url: string): string {
  try {
    const p = decodeURIComponent(new URL(url).pathname);
    const base = p.split('/').filter(Boolean).pop() || 'image';
    return base.replace(/[^\w.\-가-힣]/g, '_').slice(0, 100) || 'image';
  } catch {
    return 'image';
  }
}

/** 이미지 1개: 내려받아 → /api/upload(editor)로 POST → 프록시 URL 반환. */
async function uploadOne(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`소스 다운로드 실패 ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get('content-type') || 'application/octet-stream';
  const name = basenameFromUrl(url);

  const fd = new FormData();
  fd.append('file', new Blob([buf], { type: contentType }), name);
  fd.append('purpose', 'editor');

  // rate limit(분당 30) 대응: 429면 Retry-After만큼 대기 후 1회 재시도.
  for (let attempt = 0; attempt < 2; attempt++) {
    const up = await fetch(`${BASE_URL}/api/upload`, {
      method: 'POST',
      headers: { cookie: COOKIE },
      body: fd,
    });
    if (up.status === 429) {
      const wait = Number(up.headers.get('retry-after') || '5');
      console.log(`    · 429 rate limit → ${wait}s 대기 후 재시도`);
      await sleep((wait + 1) * 1000);
      continue;
    }
    const json = (await up.json().catch(() => null)) as
      | { ok: boolean; blobUrl?: string; message?: string }
      | null;
    if (!up.ok || !json?.ok || !json.blobUrl) {
      throw new Error(
        `업로드 실패 status=${up.status} ${json?.message ?? ''}`.trim(),
      );
    }
    return json.blobUrl; // editor → /api/files/view?key=...
  }
  throw new Error('업로드 재시도 초과 (429)');
}

async function main() {
  if (!DATABASE_URL) throw new Error('DATABASE_URL 미설정');
  if (APPLY && !COOKIE) {
    throw new Error('APPLY=1 인데 SUPPORT_COOKIE 미설정 — 로그인 세션 쿠키가 필요합니다');
  }

  const { sql, pool } = connectPg(DATABASE_URL);
  const targets: Target[] = [];

  if (ONLY !== 'notices') {
    const rows = (await sql`
      SELECT id, slug, body_markdown FROM articles
      WHERE body_markdown LIKE '%blob.vercel-storage.com%'
    `) as Array<{ id: string; slug: string; body_markdown: string }>;
    rows.forEach((r) =>
      targets.push({ table: 'articles', id: r.id, label: r.slug, body: r.body_markdown }),
    );
  }
  if (ONLY !== 'articles') {
    const rows = (await sql`
      SELECT id, title, body_markdown FROM notices
      WHERE body_markdown LIKE '%blob.vercel-storage.com%'
    `) as Array<{ id: string; title: string; body_markdown: string }>;
    rows.forEach((r) =>
      targets.push({ table: 'notices', id: r.id, label: r.title, body: r.body_markdown }),
    );
  }

  // 고유 URL 수집
  const allUrls = new Set<string>();
  for (const t of targets) {
    for (const m of t.body.matchAll(VERCEL_BLOB_RE)) allUrls.add(m[0]);
  }

  console.log('─'.repeat(60));
  console.log(`대상 레코드: ${targets.length} (articles ${targets.filter((t) => t.table === 'articles').length} / notices ${targets.filter((t) => t.table === 'notices').length})`);
  console.log(`고유 이미지 URL: ${allUrls.size}`);
  console.log(`모드: ${APPLY ? '🔴 APPLY (업로드+DB쓰기)' : '🟡 DRY-RUN (집계만)'}`);
  console.log('─'.repeat(60));

  if (!APPLY) {
    console.log('\n[dry-run] 업로드/치환 없이 종료. 실제 적용은 APPLY=1.');
    [...allUrls].slice(0, 10).forEach((u) => console.log('  ', u));
    if (allUrls.size > 10) console.log(`   ... 외 ${allUrls.size - 10}건`);
    await pool.end();
    return;
  }

  // 1) 업로드 (URL → 프록시 URL 맵)
  const map = new Map<string, string>();
  const failed = new Map<string, string>();
  let i = 0;
  for (const url of allUrls) {
    i++;
    process.stdout.write(`[${i}/${allUrls.size}] 업로드: ${url.slice(-50)} ... `);
    try {
      const proxy = await uploadOne(url);
      map.set(url, proxy);
      console.log('✓', proxy.slice(0, 48));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      failed.set(url, msg);
      console.log('✗', msg);
    }
    await sleep(2200); // 분당 30회 제한 회피
  }

  // 2) 본문 치환 + DB UPDATE (모든 URL이 성공 치환된 레코드만 갱신, 부분도 허용)
  let updated = 0;
  let skippedWithFailures = 0;
  for (const t of targets) {
    let body = t.body;
    let hadFailure = false;
    for (const m of new Set(Array.from(t.body.matchAll(VERCEL_BLOB_RE), (x) => x[0]))) {
      const proxy = map.get(m);
      if (proxy) body = body.split(m).join(proxy);
      else hadFailure = true;
    }
    if (body === t.body) {
      if (hadFailure) skippedWithFailures++;
      continue;
    }
    if (t.table === 'articles') {
      await sql`UPDATE articles SET body_markdown = ${body}, updated_at = now() WHERE id = ${t.id}`;
    } else {
      await sql`UPDATE notices SET body_markdown = ${body}, updated_at = now() WHERE id = ${t.id}`;
    }
    updated++;
    console.log(`  DB 갱신 [${t.table}] ${t.label}${hadFailure ? ' (일부 URL 실패로 잔존)' : ''}`);
  }

  // 3) 감사 로그 파일
  const report = {
    at: new Date().toISOString(),
    base: BASE_URL,
    targets: targets.length,
    uniqueUrls: allUrls.size,
    uploaded: map.size,
    failed: Object.fromEntries(failed),
    updatedRecords: updated,
    skippedWithFailures,
    mapping: Object.fromEntries(map),
  };
  const out = `/tmp/vercel-blob-migration-${Date.now()}.json`;
  writeFileSync(out, JSON.stringify(report, null, 2));

  console.log('─'.repeat(60));
  console.log(`업로드 성공 ${map.size} / 실패 ${failed.size}`);
  console.log(`DB 갱신 레코드 ${updated} / 실패URL 잔존 ${skippedWithFailures}`);
  console.log(`리포트: ${out}`);
  if (failed.size) {
    console.log('\n실패 URL:');
    for (const [u, m] of failed) console.log('  ✗', u, '—', m);
  }
  await pool.end();
}

main().catch((e) => {
  console.error('마이그레이션 실패:', e);
  process.exit(1);
});
