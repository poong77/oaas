/**
 * as.oapms.com 공지사항 → 통합AS `notices` 마이그레이션 (1회성).
 *
 * 소스: https://as.oapms.com/notice/list.do (서버 렌더링, 비로그인 접근)
 *   - 목록: `?page=N` (총 66건 / 4페이지 / 페이지당 20건)
 *     · 행 = <tr class="viewBtn" data-board_key="N"> + 제목/작성자/작성일(td)
 *   - 상세: `view.do?board_key=N`
 *     · 제목 = <div class="box">, 본문 = <div class="box contents">, 첨부 = #attaches
 *
 * 타깃: `notices` 테이블
 *   - kind/product_code = 제목·본문 키워드 기반 자동 추정
 *   - published_at = 원본 작성일 (created_at도 동일하게 보존하여 정렬 일관성)
 *   - author_id = admin@oa.local (없으면 admin/manager 1명, 그래도 없으면 null)
 *   - 첨부/본문 이미지 = Vercel Blob 재업로드 후 본문에 링크
 *
 * 실행:
 *   dry-run(기본):  npx tsx scripts/migrate-as-notices.ts
 *     → DB/Blob 미변경. /tmp + docs/dev-logs 에 미리보기 리포트 생성.
 *   commit:        npx tsx scripts/migrate-as-notices.ts --commit
 *     → Blob 업로드 + notices INSERT. (title+published_at 중복은 skip → 재실행 안전)
 */

import { config } from 'dotenv';
// .env.local(BLOB 토큰 등) 우선 → .env 보충. 먼저 적재된 값은 덮어쓰지 않음.
config({ path: '.env.local' });
config();

import { writeFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, inArray } from 'drizzle-orm';
import { notices } from '../db/schema/notices';
import { users } from '../db/schema/users';

// ──────────────────────────────────────────────────────────────────────────
// 설정
// ──────────────────────────────────────────────────────────────────────────
const ORIGIN = 'https://as.oapms.com';
const LIST_URL = `${ORIGIN}/notice/list.do`;
const VIEW_URL = `${ORIGIN}/notice/view.do`;
const TOTAL_PAGES = 4;
const FETCH_DELAY_MS = 150; // 레거시 서버 배려
const UA = 'Mozilla/5.0 (compatible; OA-NoticeMigrator/1.0)';
const COMMIT = process.argv.includes('--commit');

type Kind = 'notice' | 'release' | 'incident';

interface Attachment {
  /** 원본 절대 URL */
  src: string;
  name: string;
  /** commit 모드에서 Blob 재업로드 후 채워짐 */
  blobUrl?: string;
}

interface ParsedNotice {
  boardKey: string;
  title: string;
  bodyMarkdown: string;
  publishedAt: Date;
  kind: Kind;
  productCode: string | null;
  attachments: Attachment[];
  inlineImages: string[]; // 본문 내 <img src> (as.oapms.com 호스팅)
}

// ──────────────────────────────────────────────────────────────────────────
// 유틸
// ──────────────────────────────────────────────────────────────────────────
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 첨부 파일명(또는 URL)이 이미지인지 판별 → 본문 인라인 임베드 대상. */
function isImageAttachment(name: string): boolean {
  return /\.(png|jpe?g|gif|webp|bmp|heic|heif|svg)(\?|$)/i.test(name);
}

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

/** 레거시 본문 HTML → markdown (대부분 평문 + 줄바꿈, 간헐적 a/img). */
function htmlToMarkdown(html: string): string {
  let s = html;
  s = s.replace(
    /<img[^>]*src=["']([^"']+)["'][^>]*>/gi,
    (_, src) => `\n![](${absolutize(src)})\n`,
  );
  s = s.replace(
    /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
    (_, href, text) => {
      const label = stripTags(text) || href;
      return `[${label}](${absolutize(href)})`;
    },
  );
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<li[^>]*>/gi, '\n- ');
  s = s.replace(/<\/(p|div|li|tr|h[1-6]|ul|ol)>/gi, '\n');
  s = s.replace(/<[^>]+>/g, '');
  s = decodeEntities(s);
  s = s
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return s;
}

/**
 * 제목 기반 kind 추정 (본문은 공통 푸터 "※시스템 접속불가 등..." 보일러플레이트가
 * 오염을 일으켜 제외). 정기 점검·휴무·행정 공지는 notice로 우선 확정한다.
 */
function classifyKind(title: string): Kind {
  const t = title;
  // 1) 휴무·영업·행정·정기점검성 공지 → notice 우선 확정
  if (
    /휴무|휴일|연휴|단축\s*영업|영업\s*시간|운영\s*시간|일시\s*휴무|업무\s*(일시)?\s*중단|일시\s*중단|이전\s*안내|납부|쇼룸|점검\s*안내|규정|백업|비밀번호|재고\s*생성|계좌|사업자\s*등록|코로나|연락처\s*변경|종료\s*공지/.test(
      t,
    )
  ) {
    return 'notice';
  }
  // 2) 서비스 장애·오류·연동 문제 → incident
  if (
    /장애|먹통|다운|복구|중단|미연동|연동\s*오류|연동오류|연동\s*누락|연동\s*불안정|접속\s*오류|서버\s*이슈|누락\s*이슈|오류\s*안내|불안정/.test(
      t,
    )
  ) {
    return 'incident';
  }
  // 3) 업데이트·출시·개선 → release
  if (
    /업데이트|업그레이드|릴리[즈스]|새\s*버전|버전|신규\s*기능|기능\s*(추가|개선)|출시|개편|리뉴얼|새로워/.test(
      t,
    )
  ) {
    return 'release';
  }
  return 'notice';
}

/** 제목 기반 product_code 추정. 매칭 없으면 null(전체 공지). */
function classifyProduct(title: string): string | null {
  const t = title;
  if (/\bPMS\b|피엠에스/i.test(t)) return 'pms';
  if (/\bCMS\b|씨엠에스|호텔플러스|온다\s*CMS/i.test(t)) return 'cms';
  if (/keyless|키리스|키레스|도어락|스마트키|폰\s*\(?모바일\)?키|폰키|모바일키/i.test(t)) {
    return 'keyless';
  }
  if (/키오스크|kiosk/i.test(t)) return 'kiosk';
  if (/웹\s*서비스|홈페이지|웹\s*사이트|예약\s*엔진|부킹엔진/i.test(t)) return 'web';
  return null;
}

// ──────────────────────────────────────────────────────────────────────────
// 파싱
// ──────────────────────────────────────────────────────────────────────────
interface ListRow {
  boardKey: string;
  dateStr: string;
}

function parseList(html: string): ListRow[] {
  const rows: ListRow[] = [];
  const rowRe = /<tr class="viewBtn"[^>]*data-board_key="(\d+)"[^>]*>([\s\S]*?)<\/tr>/gi;
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(html)) !== null) {
    const boardKey = m[1];
    const dateMatch = m[2].match(/(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/);
    rows.push({ boardKey, dateStr: dateMatch ? dateMatch[1] : '' });
  }
  return rows;
}

function parseDetail(html: string): {
  title: string;
  bodyMarkdown: string;
  attachments: Attachment[];
  inlineImages: string[];
} {
  // 제목: <div class="box">...</div> (본문 div는 class="box contents"라 구분됨)
  const titleM = html.match(/<div class="box">([\s\S]*?)<\/div>/i);
  const title = titleM ? stripTags(titleM[1]) : '(제목 없음)';

  // 본문: <div class="box contents"> ~ <!-- 첨부파일 (nested div 안전하게 컷)
  let bodyHtml = '';
  const bodyM = html.match(/<div class="box contents">([\s\S]*?)<!-- 첨부파일/i);
  if (bodyM) {
    bodyHtml = bodyM[1].replace(/<\/div>\s*<\/div>\s*$/i, '');
  } else {
    const fb = html.match(/<div class="box contents">([\s\S]*?)<\/div>/i);
    bodyHtml = fb ? fb[1] : '';
  }
  const bodyMarkdown = htmlToMarkdown(bodyHtml);

  // 첨부: #attaches ul 내부 <a href>
  const attachments: Attachment[] = [];
  const attBlock = html.match(/id="attaches"[^>]*>([\s\S]*?)<\/ul>/i);
  if (attBlock) {
    const aRe = /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let am: RegExpExecArray | null;
    while ((am = aRe.exec(attBlock[1])) !== null) {
      const src = absolutize(am[1]);
      if (/^https?:/i.test(src) && !src.endsWith('#')) {
        attachments.push({ src, name: stripTags(am[2]) || 'attachment' });
      }
    }
  }

  // 본문 인라인 이미지 (as.oapms.com 호스팅만)
  const inlineImages: string[] = [];
  const imgRe = /!\[\]\(([^)]+)\)/g;
  let im: RegExpExecArray | null;
  while ((im = imgRe.exec(bodyMarkdown)) !== null) {
    if (im[1].includes('oapms.com')) inlineImages.push(im[1]);
  }

  return { title, bodyMarkdown, attachments, inlineImages };
}

// ──────────────────────────────────────────────────────────────────────────
// Blob 업로드 (commit 전용)
// ──────────────────────────────────────────────────────────────────────────
async function uploadToBlob(srcUrl: string, boardKey: string): Promise<string> {
  const { put } = await import('@vercel/blob');
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error('BLOB_READ_WRITE_TOKEN 미설정 — 첨부 이관 불가');

  const res = await fetch(srcUrl, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`첨부 다운로드 실패 ${srcUrl} → ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());

  const rawName = decodeURIComponent(srcUrl.split('/').pop()?.split('?')[0] || 'file');
  const safeName = rawName.replace(/[^\w.\-가-힣]/g, '_').slice(0, 120) || 'file';
  const pathname = `notices/migrated/${boardKey}/${Date.now()}-${safeName}`;
  const result = await put(pathname, buf, {
    access: 'public',
    addRandomSuffix: false,
    token,
    contentType: res.headers.get('content-type') || undefined,
  });
  return result.url;
}

// ──────────────────────────────────────────────────────────────────────────
// 리포트
// ──────────────────────────────────────────────────────────────────────────
function buildHtmlReport(items: ParsedNotice[], authorLabel: string): string {
  const byKind = (k: Kind) => items.filter((i) => i.kind === k).length;
  const byProduct = (p: string | null) =>
    items.filter((i) => i.productCode === p).length;
  const withAtt = items.filter((i) => i.attachments.length > 0).length;
  const products = ['pms', 'cms', 'keyless', 'kiosk', 'web'] as const;

  const rows = items
    .map(
      (i, idx) => `<tr>
      <td>${idx + 1}</td>
      <td class="key">${i.boardKey}</td>
      <td>${i.publishedAt.toISOString().slice(0, 10)}</td>
      <td><span class="badge k-${i.kind}">${i.kind}</span></td>
      <td>${i.productCode ? `<span class="badge prod">${i.productCode}</span>` : '<span class="muted">전체</span>'}</td>
      <td class="title">${escapeHtml(i.title)}</td>
      <td class="num">${i.bodyMarkdown.length.toLocaleString()}자</td>
      <td class="num">${i.attachments.length || ''}</td>
    </tr>`,
    )
    .join('\n');

  return `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>as.oapms.com 공지 마이그레이션 미리보기</title>
<style>
:root{--p:#2563eb;--bg:#f8fafc;--bd:#e2e8f0;--mut:#64748b}
*{box-sizing:border-box}body{font-family:system-ui,-apple-system,'Apple SD Gothic Neo',sans-serif;margin:0;background:var(--bg);color:#0f172a;line-height:1.6}
.wrap{max-width:1100px;margin:0 auto;padding:32px 20px}
h1{font-size:22px;margin:0 0 4px}.sub{color:var(--mut);margin:0 0 24px;font-size:14px}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:28px}
.card{background:#fff;border:1px solid var(--bd);border-radius:12px;padding:16px}
.card .n{font-size:26px;font-weight:700}.card .l{color:var(--mut);font-size:13px}
table{width:100%;border-collapse:collapse;background:#fff;border:1px solid var(--bd);border-radius:12px;overflow:hidden;font-size:13px}
th,td{padding:9px 11px;text-align:left;border-bottom:1px solid var(--bd)}
th{background:#f1f5f9;font-weight:600;font-size:12px;color:#334155}
tr:last-child td{border-bottom:0}
.title{max-width:340px}.num{text-align:right;color:var(--mut)}.key{color:var(--mut);font-variant-numeric:tabular-nums}
.muted{color:var(--mut)}
.badge{display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600}
.k-notice{background:#dbeafe;color:#1d4ed8}.k-release{background:#dcfce7;color:#15803d}.k-incident{background:#fee2e2;color:#b91c1c}
.prod{background:#f1f5f9;color:#475569}
.note{margin-top:20px;padding:14px 16px;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;font-size:13px;color:#92400e}
</style></head><body><div class="wrap">
<h1>as.oapms.com 공지 마이그레이션 미리보기</h1>
<p class="sub">총 ${items.length}건 · 작성자 매핑: ${escapeHtml(authorLabel)} · 모드: ${COMMIT ? 'COMMIT' : 'DRY-RUN (DB 미변경)'}</p>
<div class="cards">
  <div class="card"><div class="n">${items.length}</div><div class="l">총 공지</div></div>
  <div class="card"><div class="n">${byKind('notice')}</div><div class="l">notice 일반</div></div>
  <div class="card"><div class="n">${byKind('release')}</div><div class="l">release 업데이트</div></div>
  <div class="card"><div class="n">${byKind('incident')}</div><div class="l">incident 장애</div></div>
  <div class="card"><div class="n">${byProduct(null)}</div><div class="l">전체 공지</div></div>
  <div class="card"><div class="n">${withAtt}</div><div class="l">첨부 포함</div></div>
</div>
<table><thead><tr>
<th>#</th><th>board_key</th><th>작성일</th><th>kind</th><th>제품</th><th>제목</th><th>본문</th><th>첨부</th>
</tr></thead><tbody>
${rows}
</tbody></table>
<div class="note">제품 분류: ${products.map((p) => `${p} ${byProduct(p)}`).join(' · ')} · 전체 ${byProduct(null)}건.
이 표를 검토한 뒤 <code>--commit</code> 으로 실제 적재하세요. kind/제품은 적재 후 어드민에서 개별 수정 가능합니다.</div>
</div></body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ──────────────────────────────────────────────────────────────────────────
// 메인
// ──────────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n[migrate-as-notices] 모드: ${COMMIT ? 'COMMIT (DB/Blob 적재)' : 'DRY-RUN (미리보기)'}`);

  // 1) 목록 수집
  const listRows: ListRow[] = [];
  for (let page = 1; page <= TOTAL_PAGES; page++) {
    const html = await fetchText(`${LIST_URL}?page=${page}`);
    const rows = parseList(html);
    console.log(`  목록 page ${page}: ${rows.length}건`);
    listRows.push(...rows);
    await sleep(FETCH_DELAY_MS);
  }
  console.log(`  → 목록 합계 ${listRows.length}건`);

  // 2) 상세 수집 + 파싱
  const items: ParsedNotice[] = [];
  for (const row of listRows) {
    const html = await fetchText(`${VIEW_URL}?board_key=${row.boardKey}`);
    const d = parseDetail(html);
    const publishedAt = row.dateStr
      ? new Date(row.dateStr.replace(' ', 'T') + '+09:00')
      : new Date('2020-01-01T00:00:00+09:00');
    items.push({
      boardKey: row.boardKey,
      title: d.title,
      bodyMarkdown: d.bodyMarkdown,
      publishedAt,
      kind: classifyKind(d.title),
      productCode: classifyProduct(d.title),
      attachments: d.attachments,
      inlineImages: d.inlineImages,
    });
    await sleep(FETCH_DELAY_MS);
  }
  console.log(`  → 상세 파싱 ${items.length}건`);

  // 3) 작성자 계정 조회
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL 미설정 — .env / .env.local 확인');
  }
  const db = drizzle(neon(process.env.DATABASE_URL), { schema: { notices, users } });

  let authorId: string | null = null;
  let authorLabel = 'null(시스템)';
  const adminByEmail = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(eq(users.email, 'admin@oa.local'))
    .limit(1);
  if (adminByEmail.length) {
    authorId = adminByEmail[0].id;
    authorLabel = `${adminByEmail[0].name} <${adminByEmail[0].email}>`;
  } else {
    const anyStaff = await db
      .select({ id: users.id, name: users.name, email: users.email, role: users.role })
      .from(users)
      .where(inArray(users.role, ['admin', 'manager']))
      .limit(1);
    if (anyStaff.length) {
      authorId = anyStaff[0].id;
      authorLabel = `${anyStaff[0].name} <${anyStaff[0].email}> (${anyStaff[0].role})`;
    }
  }
  console.log(`  작성자 매핑: ${authorLabel}`);

  // 4) 리포트 (항상 생성)
  const jsonPath = '/tmp/as-notices-migration.json';
  writeFileSync(jsonPath, JSON.stringify(items, null, 2));
  const htmlPath = 'docs/dev-logs/2026-06-01-notice-migration-preview.html';
  writeFileSync(htmlPath, buildHtmlReport(items, authorLabel));
  console.log(`  리포트: ${jsonPath}`);
  console.log(`  리포트: ${htmlPath}`);

  const summary = {
    notice: items.filter((i) => i.kind === 'notice').length,
    release: items.filter((i) => i.kind === 'release').length,
    incident: items.filter((i) => i.kind === 'incident').length,
    withAttachments: items.filter((i) => i.attachments.length > 0).length,
    inlineImages: items.reduce((a, i) => a + i.inlineImages.length, 0),
  };
  console.log('  분류 요약:', JSON.stringify(summary));

  if (!COMMIT) {
    console.log('\n[DRY-RUN] DB/Blob 미변경. 리포트 검토 후 `--commit` 으로 실제 적재하세요.\n');
    return;
  }

  // 5) COMMIT — 중복(title+published_at) 제외하고 INSERT
  const existing = await db
    .select({ title: notices.title, publishedAt: notices.publishedAt })
    .from(notices);
  const existKey = new Set(
    existing.map((e) => `${e.title}|${e.publishedAt?.toISOString() ?? ''}`),
  );

  let inserted = 0;
  let skipped = 0;
  for (const item of items) {
    const key = `${item.title}|${item.publishedAt.toISOString()}`;
    if (existKey.has(key)) {
      skipped++;
      continue;
    }

    // 5a) 첨부 + 인라인 이미지 Blob 재업로드 → 본문 갱신
    let body = item.bodyMarkdown;
    for (const img of item.inlineImages) {
      try {
        const blobUrl = await uploadToBlob(img, item.boardKey);
        body = body.split(img).join(blobUrl);
      } catch (err) {
        console.warn(`    ⚠ 이미지 이관 실패 (board ${item.boardKey}): ${(err as Error).message}`);
      }
    }
    if (item.attachments.length) {
      const imageBlocks: string[] = []; // 이미지 → 본문 인라인 임베드
      const fileLines: string[] = []; // 그 외 → 첨부파일 다운로드 링크
      for (const att of item.attachments) {
        let url = att.src;
        try {
          att.blobUrl = await uploadToBlob(att.src, item.boardKey);
          url = att.blobUrl;
        } catch (err) {
          console.warn(`    ⚠ 첨부 이관 실패 (board ${item.boardKey}): ${(err as Error).message}`);
          // 실패 시 원본 링크 fallback (url = att.src 유지)
        }
        if (isImageAttachment(att.name) || isImageAttachment(att.src)) {
          imageBlocks.push(`![${att.name}](${url})`);
        } else {
          fileLines.push(`- [${att.name}](${url})`);
        }
      }
      if (imageBlocks.length) body += `\n\n${imageBlocks.join('\n\n')}`;
      if (fileLines.length) {
        body += `\n\n---\n\n**첨부파일**\n\n${fileLines.join('\n')}`;
      }
    }

    await db.insert(notices).values({
      kind: item.kind,
      productCode: item.productCode,
      title: item.title,
      bodyMarkdown: body,
      pinned: false,
      banner: false,
      publishedAt: item.publishedAt,
      viewCount: 0,
      authorId,
      createdAt: item.publishedAt, // 원본 작성일로 정렬 일관성 보존
    });
    inserted++;
    console.log(`    + [${item.kind}/${item.productCode ?? '전체'}] ${item.title}`);
  }

  console.log(`\n[COMMIT 완료] 신규 ${inserted}건 / 중복 skip ${skipped}건\n`);
}

main().catch((err) => {
  console.error('\n[migrate-as-notices] 실패:', err);
  process.exit(1);
});
