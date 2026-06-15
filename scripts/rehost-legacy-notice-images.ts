/**
 * 레거시 공지 본문의 깨진 이미지(as.oapms.com/file/download.do — temp_uploads 만료)를
 * **최초 마이그레이션 때 S3에 올라간 사본**으로 재연결한다.
 *
 * 배경:
 *   2026-06-15 notices 유실 사고 후 로컬에서 재이관(migrate-as-notices)했는데,
 *   로컬엔 S3 쓰기 권한이 없어 첨부를 우리 S3로 못 옮기고 원본 download.do 링크로
 *   fallback 저장됨. 그 원본이 만료(400)돼 본문 이미지가 깨졌다.
 *   최초(서버) 마이그레이션이 올린 S3 객체는 `notices/migrated/<boardKey>/<ts>-<name>`
 *   형태로 버킷에 그대로 남아있다 → 이걸 찾아 본문 URL을 갈아끼운다.
 *
 * 매칭:
 *   - as.oapms.com 목록/상세를 재수집해 boardKey·제목·작성일·첨부명을 얻는다.
 *     (목록/상세 페이지는 살아있음. 만료된 건 temp_uploads 파일 자체뿐)
 *   - DB 공지는 (title + published_at)로 식별 (migrate-as-notices의 dedup 키와 동일).
 *   - 본문의 `…download.do?…&name=<파일명>` URL → S3 `…/notices/migrated/<boardKey>/`
 *     에서 `-<safeName>`으로 끝나는 키를 찾아 publicUrl로 치환.
 *
 * ⚠️ 실행 환경: S3 ListObjects 권한이 필요하다. 로컬 자격증명은 List가 막혀 있어
 *   **EC2(인스턴스 IAM 롤) 등 S3 접근 가능한 곳에서 실행**해야 한다.
 *
 * 실행:
 *   dry-run(기본):  npx tsx scripts/rehost-legacy-notice-images.ts
 *     → DB 미변경. 매칭/미매칭 리포트만 출력.
 *   commit:        npx tsx scripts/rehost-legacy-notice-images.ts --commit
 *     → 본문 URL 치환 UPDATE. 멱등(이미 S3 URL이면 skip).
 */

import { config } from 'dotenv';
config({ path: '.env.local' });
config();

import { connectPg } from '../db/connect';
import { and, eq } from 'drizzle-orm';
import { notices } from '../db/schema/notices';

const ORIGIN = 'https://as.oapms.com';
const LIST_URL = `${ORIGIN}/notice/list.do`;
const VIEW_URL = `${ORIGIN}/notice/view.do`;
const TOTAL_PAGES = 4;
const FETCH_DELAY_MS = 150;
const UA = 'Mozilla/5.0 (compatible; OA-NoticeRehost/1.0)';
const COMMIT = process.argv.includes('--commit');

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
  return res.text();
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}
function stripTags(s: string): string {
  return decodeEntities(s.replace(/<[^>]+>/g, '')).trim();
}
function absolutize(href: string): string {
  if (/^https?:\/\//i.test(href)) return href;
  if (href.startsWith('//')) return `https:${href}`;
  if (href.startsWith('/')) return `${ORIGIN}${href}`;
  if (href.startsWith('./')) return `${ORIGIN}/notice/${href.slice(2)}`;
  return `${ORIGIN}/notice/${href}`;
}

/** migrate-as-notices.uploadToS3 와 동일한 파일명 정규화 (S3 키 끝부분 매칭용). */
function safeNameOf(srcUrl: string): string {
  const rawName = decodeURIComponent(
    srcUrl.split('/').pop()?.split('?')[0] || 'file',
  );
  // download.do?…&name=<파일명> 형태면 name 파라미터가 진짜 파일명
  let raw = rawName;
  const nameParam = srcUrl.match(/[?&]name=([^&]+)/);
  if (nameParam) raw = decodeURIComponent(nameParam[1]);
  return raw.replace(/[^\w.\-가-힣]/g, '_').slice(0, 120) || 'file';
}

interface ListRow {
  boardKey: string;
  dateStr: string;
}
function parseList(html: string): ListRow[] {
  const rows: ListRow[] = [];
  const rowRe =
    /<tr class="viewBtn"[^>]*data-board_key="(\d+)"[^>]*>([\s\S]*?)<\/tr>/gi;
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(html)) !== null) {
    const dateMatch = m[2].match(/(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/);
    rows.push({ boardKey: m[1], dateStr: dateMatch ? dateMatch[1] : '' });
  }
  return rows;
}
function parseDetailTitleAndAttachUrls(html: string): {
  title: string;
  attachUrls: string[];
} {
  const titleM = html.match(/<div class="box">([\s\S]*?)<\/div>/i);
  const title = titleM ? stripTags(titleM[1]) : '(제목 없음)';
  const attachUrls: string[] = [];
  const attBlock = html.match(/id="attaches"[^>]*>([\s\S]*?)<\/ul>/i);
  if (attBlock) {
    const aRe = /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let am: RegExpExecArray | null;
    while ((am = aRe.exec(attBlock[1])) !== null) {
      const src = absolutize(am[1]);
      if (/^https?:/i.test(src) && !src.endsWith('#')) attachUrls.push(src);
    }
  }
  return { title, attachUrls };
}

interface Item {
  boardKey: string;
  title: string;
  publishedAt: Date;
  attachUrls: string[];
}

async function listS3Keys(
  boardKey: string,
): Promise<string[]> {
  const { S3Client, ListObjectsV2Command } = await import(
    '@aws-sdk/client-s3'
  );
  const bucket =
    process.env.S3_UPLOAD_BUCKET ||
    (process.env.S3_UPLOAD_PUBLIC_URL || '').match(
      /https?:\/\/([^.]+)\.s3/,
    )?.[1] ||
    'oaas-uploads-prd';
  const region = process.env.AWS_REGION || 'ap-northeast-2';
  const prefix = (process.env.S3_UPLOAD_PREFIX || '').replace(
    /^\/+|\/+$/g,
    '',
  );
  const base = prefix
    ? `${prefix}/notices/migrated/${boardKey}/`
    : `notices/migrated/${boardKey}/`;
  const client = new S3Client({ region });
  const keys: string[] = [];
  let token: string | undefined;
  do {
    const r = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: base,
        ContinuationToken: token,
      }),
    );
    (r.Contents || []).forEach((o) => o.Key && keys.push(o.Key));
    token = r.IsTruncated ? r.NextContinuationToken : undefined;
  } while (token);
  return keys;
}

function publicUrlOf(key: string): string {
  const base = (process.env.S3_UPLOAD_PUBLIC_URL || '').replace(/\/$/, '');
  if (base) return `${base}/${key}`;
  const bucket = process.env.S3_UPLOAD_BUCKET || 'oaas-uploads-prd';
  const region = process.env.AWS_REGION || 'ap-northeast-2';
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}

async function main() {
  console.log(
    `\n[rehost-legacy-notice-images] 모드: ${COMMIT ? 'COMMIT (DB 갱신)' : 'DRY-RUN (미리보기)'}`,
  );

  // 1) 목록 → boardKey + 작성일
  const listRows: ListRow[] = [];
  for (let page = 1; page <= TOTAL_PAGES; page++) {
    const html = await fetchText(`${LIST_URL}?page=${page}`);
    listRows.push(...parseList(html));
    await sleep(FETCH_DELAY_MS);
  }
  console.log(`  목록 ${listRows.length}건`);

  // 2) 상세 → 제목 + 첨부 URL
  const items: Item[] = [];
  for (const row of listRows) {
    const html = await fetchText(`${VIEW_URL}?board_key=${row.boardKey}`);
    const d = parseDetailTitleAndAttachUrls(html);
    const publishedAt = row.dateStr
      ? new Date(row.dateStr.replace(' ', 'T') + '+09:00')
      : new Date('2020-01-01T00:00:00+09:00');
    items.push({
      boardKey: row.boardKey,
      title: d.title,
      publishedAt,
      attachUrls: d.attachUrls,
    });
    await sleep(FETCH_DELAY_MS);
  }
  console.log(`  상세 ${items.length}건`);

  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL 미설정');
  const { db } = connectPg(process.env.DATABASE_URL);

  let touched = 0;
  let urlsReplaced = 0;
  let urlsUnmatched = 0;
  const unmatchedSamples: string[] = [];

  for (const item of items) {
    // DB 공지 조회 (title + published_at)
    const rows = await db
      .select({ id: notices.id, body: notices.bodyMarkdown })
      .from(notices)
      .where(
        and(
          eq(notices.title, item.title),
          eq(notices.publishedAt, item.publishedAt),
        ),
      )
      .limit(1);
    if (!rows.length) continue;
    const { id, body } = rows[0];
    if (!body || !body.includes('download.do')) continue;

    // S3 키 목록 (해당 boardKey)
    let s3keys: string[] = [];
    try {
      s3keys = await listS3Keys(item.boardKey);
    } catch (e) {
      console.warn(
        `    ⚠ S3 list 실패 (board ${item.boardKey}): ${(e as Error).message}`,
      );
      continue;
    }

    // 본문 내 깨진 download.do URL 추출 → 파일명 매칭 → 치환
    let newBody = body;
    const brokenUrls = (
      newBody.match(
        /https?:\/\/as\.oapms\.com\/file\/download\.do[^)\s]*/g,
      ) || []
    ).filter((u, i, a) => a.indexOf(u) === i);

    for (const oldUrl of brokenUrls) {
      const sn = safeNameOf(oldUrl);
      const hit =
        s3keys.find((k) => k.endsWith(`-${sn}`)) ||
        s3keys.find((k) => k.endsWith(sn)) ||
        s3keys.find((k) => decodeURIComponent(k).endsWith(`-${sn}`));
      if (hit) {
        newBody = newBody.split(oldUrl).join(publicUrlOf(hit));
        urlsReplaced++;
      } else {
        urlsUnmatched++;
        if (unmatchedSamples.length < 12)
          unmatchedSamples.push(
            `board ${item.boardKey} / ${sn} (S3 ${s3keys.length}키)`,
          );
      }
    }

    if (newBody !== body) {
      touched++;
      console.log(`    ~ [board ${item.boardKey}] ${item.title}`);
      if (COMMIT) {
        await db
          .update(notices)
          .set({ bodyMarkdown: newBody, updatedAt: new Date() })
          .where(eq(notices.id, id));
      }
    }
  }

  console.log(
    `\n[${COMMIT ? 'COMMIT 완료' : 'DRY-RUN'}] 공지 ${touched}건 / URL 치환 ${urlsReplaced}개 / 미매칭 ${urlsUnmatched}개`,
  );
  if (unmatchedSamples.length) {
    console.log('  미매칭 샘플:');
    unmatchedSamples.forEach((s) => console.log('   -', s));
  }
  if (!COMMIT)
    console.log('\n  검토 후 `--commit` 으로 실제 치환하세요.\n');
}

main().catch((err) => {
  console.error('\n[rehost-legacy-notice-images] 실패:', err);
  process.exit(1);
});
