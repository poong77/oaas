/**
 * 레거시 공지 본문의 깨진 이미지(as.oapms.com/file/download.do)를 우리 S3로 재호스팅한다.
 *
 * 배경:
 *   2026-06-15 notices 유실 사고 후 로컬에서 재이관했는데, 로컬엔 S3 쓰기 권한이 없어
 *   첨부를 우리 S3로 못 옮기고 원본 download.do 링크로 fallback 저장됨. 그 링크는
 *   핫링크 차단(Referer 필요) 때문에 브라우저에서 깨져 보인다.
 *
 * 방식 (S3 자격증명·EC2 불필요 — 전부 로컬에서 가능):
 *   1. 본문에서 `…/file/download.do?…` URL을 찾는다 (DB에 이미 있음).
 *   2. Referer 헤더를 붙여 원본 이미지를 다시 내려받는다 (핫링크 차단 우회).
 *   3. 배포된 `/api/upload`(purpose=editor)로 인증 POST → 서버 IAM Role이 S3에 PUT,
 *      `/api/files/view?key=…` 프록시 URL을 돌려준다 (로그인 게이트 통과 후 표시).
 *   4. 본문의 깨진 URL을 프록시 URL로 치환하고 UPDATE.
 *
 * 환경변수:
 *   - DATABASE_URL   : 운영 DB (.env.local에 설정됨)
 *   - SUPPORT_COOKIE : 로그인된 support.oapms.com 브라우저의 Cookie 헤더 전체 문자열
 *   - BASE_URL       : 기본 https://support.oapms.com
 *
 * 실행:
 *   dry-run(기본):  npx tsx scripts/rehost-legacy-notice-images.ts
 *     → 원본 이미지 도달 가능 여부만 점검(업로드/DB 미변경).
 *   commit:        npx tsx scripts/rehost-legacy-notice-images.ts --commit
 *     → 업로드 + 본문 URL 치환. 멱등(이미 /api/files/view 이면 건드릴 게 없음).
 */

import { config } from 'dotenv';
config({ path: '.env.local' });
config();

import { connectPg } from '../db/connect';
import { eq } from 'drizzle-orm';
import { notices } from '../db/schema/notices';

const DATABASE_URL = process.env.DATABASE_URL;
const COOKIE = process.env.SUPPORT_COOKIE ?? '';
const BASE_URL = (process.env.BASE_URL ?? 'https://support.oapms.com').replace(
  /\/$/,
  '',
);
const COMMIT = process.argv.includes('--commit');
const REFERER = 'https://as.oapms.com/notice/list.do';
const UA = 'Mozilla/5.0 (compatible; OA-NoticeRehost/1.0)';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 깨진 download.do URL만 매칭 (본문에 여러 개 가능). */
const BROKEN_RE = /https?:\/\/as\.oapms\.com\/file\/download\.do[^)\s"']*/g;

function filenameFromUrl(url: string): string {
  const nameParam = url.match(/[?&]name=([^&]+)/);
  if (nameParam) {
    try {
      return decodeURIComponent(nameParam[1]);
    } catch {
      return nameParam[1];
    }
  }
  const last = url.split('/').pop()?.split('?')[0] || 'file';
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
}

function contentTypeFromName(name: string): string {
  const ext = name.toLowerCase().split('.').pop() || '';
  const map: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    bmp: 'image/bmp',
    svg: 'image/svg+xml',
    heic: 'image/heic',
    heif: 'image/heif',
  };
  return map[ext] || 'application/octet-stream';
}

/** 원본 이미지 다운로드 (Referer로 핫링크 차단 우회). */
async function fetchImage(
  url: string,
): Promise<{ buf: Buffer; name: string; contentType: string }> {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Referer: REFERER },
  });
  if (!res.ok) throw new Error(`원본 다운로드 실패 ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length === 0) throw new Error('원본 응답이 비어있음(0 bytes)');
  const name = filenameFromUrl(url);
  return { buf, name, contentType: contentTypeFromName(name) };
}

/** /api/upload(editor)로 POST → /api/files/view?key=… 프록시 URL 반환. */
async function uploadOne(
  buf: Buffer,
  name: string,
  contentType: string,
): Promise<string> {
  const fd = new FormData();
  fd.append('file', new Blob([new Uint8Array(buf)], { type: contentType }), name);
  fd.append('purpose', 'editor');

  for (let attempt = 0; attempt < 3; attempt++) {
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
    const json = (await up.json().catch(() => null)) as {
      ok: boolean;
      blobUrl?: string;
      message?: string;
    } | null;
    if (!up.ok || !json?.ok || !json.blobUrl) {
      throw new Error(
        `업로드 실패 status=${up.status} ${json?.message ?? ''}`.trim(),
      );
    }
    return json.blobUrl;
  }
  throw new Error('업로드 실패: rate limit 재시도 초과');
}

async function main() {
  console.log(
    `\n[rehost-legacy-notice-images] 모드: ${COMMIT ? 'COMMIT (업로드+DB 갱신)' : 'DRY-RUN (도달성 점검)'}`,
  );
  if (!DATABASE_URL) throw new Error('DATABASE_URL 미설정 (.env.local 확인)');
  if (COMMIT && !COOKIE) {
    throw new Error(
      'SUPPORT_COOKIE 미설정 — 로그인된 support.oapms.com 의 Cookie 헤더를 환경변수로 넘겨주세요.',
    );
  }

  const { db } = connectPg(DATABASE_URL);
  const rows = await db
    .select({ id: notices.id, title: notices.title, body: notices.bodyMarkdown })
    .from(notices);

  // URL별 업로드 결과 캐시 (같은 이미지가 여러 본문에 있으면 1회만 업로드)
  const urlCache = new Map<string, string>();

  let touchedNotices = 0;
  let replaced = 0;
  let failed = 0;
  const failSamples: string[] = [];

  for (const row of rows) {
    const body = row.body || '';
    if (!body.includes('/file/download.do')) continue;
    const urls = [...new Set(body.match(BROKEN_RE) || [])];
    if (!urls.length) continue;

    let newBody = body;
    let changedHere = false;

    for (const oldUrl of urls) {
      try {
        let newUrl = urlCache.get(oldUrl);
        if (!newUrl) {
          const { buf, name, contentType } = await fetchImage(oldUrl);
          if (COMMIT) {
            newUrl = await uploadOne(buf, name, contentType);
            urlCache.set(oldUrl, newUrl);
            await sleep(250); // rate limit(30/분) 여유
          } else {
            // dry-run: 도달성만 확인, 치환은 가상으로 표기
            newUrl = `[업로드예정 ${(buf.length / 1024).toFixed(0)}KB]`;
          }
        }
        if (COMMIT) {
          newBody = newBody.split(oldUrl).join(newUrl);
          changedHere = true;
        }
        replaced++;
      } catch (e) {
        failed++;
        if (failSamples.length < 15)
          failSamples.push(`${row.title} :: ${(e as Error).message}`);
      }
    }

    if (COMMIT && changedHere && newBody !== body) {
      await db
        .update(notices)
        .set({ bodyMarkdown: newBody, updatedAt: new Date() })
        .where(eq(notices.id, row.id));
      touchedNotices++;
      console.log(`    ~ ${row.title}`);
    } else if (!COMMIT) {
      console.log(`    · ${row.title} (이미지 ${urls.length}개)`);
    }
  }

  console.log(
    `\n[${COMMIT ? 'COMMIT 완료' : 'DRY-RUN'}] ` +
      `갱신 공지 ${touchedNotices} · 이미지 ${COMMIT ? '재호스팅' : '도달확인'} ${replaced} · 실패 ${failed}`,
  );
  if (failSamples.length) {
    console.log('  실패 샘플:');
    failSamples.forEach((s) => console.log('   -', s));
  }
  if (!COMMIT)
    console.log('\n  도달성 OK면 `--commit` 으로 실제 재호스팅하세요.\n');
}

main().catch((err) => {
  console.error('\n[rehost-legacy-notice-images] 실패:', err);
  process.exit(1);
});
