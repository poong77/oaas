/**
 * help.oapms.com → 통합AS articles 이관 (Pilot: 실시간 객실(오늘)).
 *
 * 동작:
 *   1) cf.channel.io 이미지 → Vercel Blob 재업로드 (안정 URL 확보)
 *   2) 1개 원본 아티클을 의도별 3개 아티클로 분할 (feature/howto/troubleshoot)
 *   3) slug = generateOpsIdSlug 패턴 (`{product}-{ct}-{seq3}`)
 *   4) status='draft' — 어드민에서 검수 후 발행
 *
 * 멱등성:
 *   - 동일 (productCode, title) 존재 시 skip — 카운터 소비 없음
 *   - 이미지는 allowOverwrite=true로 같은 경로에 덮어쓰기
 *
 * 사용:
 *   node scripts/import-help-articles.mjs
 *
 * 환경:
 *   - DATABASE_URL (Neon)
 *   - BLOB_READ_WRITE_TOKEN (Vercel Blob)
 */
import { config as loadEnv } from 'dotenv';
import { existsSync } from 'node:fs';
import { put } from '@vercel/blob';
import { neon } from '@neondatabase/serverless';

// .env → .env.local (Next.js convention: .env.local overrides)
loadEnv({ path: '.env' });
if (existsSync('.env.local')) loadEnv({ path: '.env.local', override: true });

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

const EXT_BY_MIME = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
};

async function migrateImage(srcUrl, dstPathNoExt) {
  console.log(`  [img] fetch ${srcUrl}`);
  const res = await fetch(srcUrl);
  if (!res.ok) throw new Error(`fetch ${srcUrl} → ${res.status}`);
  const ctRaw = res.headers.get('content-type') ?? 'image/png';
  const mime = ctRaw.split(';')[0].trim().toLowerCase();
  const ext = EXT_BY_MIME[mime] ?? 'png';
  const buf = Buffer.from(await res.arrayBuffer());
  const path = `${dstPathNoExt}.${ext}`;
  const blob = await put(path, buf, {
    access: 'public',
    contentType: mime,
    addRandomSuffix: false,
    allowOverwrite: true,
    token: blobToken,
  });
  console.log(`  [img] → ${blob.url} (${buf.length} bytes, ${mime})`);
  return blob.url;
}

function extractToc(markdown) {
  const entries = [];
  let inCodeBlock = false;
  for (const raw of markdown.split('\n')) {
    const line = raw.trim();
    if (line.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
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

async function insertArticle(spec, authorId) {
  const existing = await sql`
    SELECT id, slug FROM articles
    WHERE product_code = ${spec.productCode} AND title = ${spec.title}
    LIMIT 1
  `;
  if (existing.length > 0) {
    console.log(`  [skip] "${spec.title}" — 이미 존재 (slug: ${existing[0].slug})`);
    return { ok: false, skipped: true };
  }
  const slug = await generateOpsIdSlug(spec.productCode, spec.contentType);
  const toc = extractToc(spec.bodyMarkdown);
  await sql`
    INSERT INTO articles (
      product_code, content_type, status, category_path,
      slug, title, summary, summary_30s, keywords,
      body_markdown, toc, author_id, last_editor_id,
      published_at, related_slugs
    ) VALUES (
      ${spec.productCode}, ${spec.contentType}, 'draft', ${spec.categoryPath},
      ${slug}, ${spec.title}, ${spec.summary}, ${spec.summary}, ${spec.keywords},
      ${spec.bodyMarkdown}, ${JSON.stringify(toc)}::jsonb, ${authorId}, ${authorId},
      NULL, '{}'::text[]
    )
  `;
  console.log(`  [create] ${slug} — "${spec.title}"`);
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
console.log(`✓ author: manager@oa.local (${authorId})`);

// 메뉴 트리(중·소분류) 존재 확인
const [menuCheck] = await sql`
  SELECT COUNT(*)::int AS n FROM menu_taxonomies
  WHERE product_code = 'pms' AND label = '실시간 객실(오늘)'
`;
if (menuCheck.n === 0) {
  console.error('❌ menu_taxonomies에 PMS > 실시간 객실(오늘) 노드가 없습니다. `npm run db:seed` 필요.');
  process.exit(1);
}
console.log('✓ menu_taxonomies 트리 확인 (PMS > 실시간 객실(오늘))');

// ─────────────────────────────────────────────────────────────
// 1. 이미지 이관 (cf.channel.io → Vercel Blob)
// ─────────────────────────────────────────────────────────────

const SRC_HASH = 'b02884a7'; // help.oapms.com '실시간 객실(오늘)' 원본 해시
const IMG_BASE = 'https://cf.channel.io/document/spaces/15320/usermedia';
const BLOB_DIR = `articles/source/${SRC_HASH}`;

console.log('\n[1/2] 이미지 이관 (cf.channel.io → Vercel Blob)');
const img1 = await migrateImage(`${IMG_BASE}/692fe6c9c6ac424fd610`, `${BLOB_DIR}/01`);
const img2 = await migrateImage(`${IMG_BASE}/69128a7f102598c92e4d`, `${BLOB_DIR}/02`);
const img3 = await migrateImage(`${IMG_BASE}/69128a74b37176b24b59`, `${BLOB_DIR}/03`);

// ─────────────────────────────────────────────────────────────
// 2. 아티클 사양 (3분할)
// ─────────────────────────────────────────────────────────────

const PRODUCT = 'pms';
const CATEGORY_PATH = ['객실관리', '실시간 객실(오늘)'];

const specs = [
  {
    productCode: PRODUCT,
    contentType: 'feature',
    categoryPath: CATEGORY_PATH,
    title: '실시간 객실(오늘) 화면 구성',
    summary:
      'PMS 메인 운영 화면. 당일 객실을 필터·카드형으로 한눈에 보고, 11종 객실 상태값 의미를 정리합니다.',
    keywords: ['실시간객실', '객실상태', '화면구성', '필터', '카드뷰'],
    bodyMarkdown: `## 개요

실시간 객실(오늘)은 PMS에서 당일 객실 상태를 한 화면으로 파악하는 메인 운영 화면입니다.
프론트 데스크 운영자가 가장 자주 보는 화면으로, 필터와 카드형 표시를 통해 호실·현 상태·투숙기간·투숙자명을 즉시 확인할 수 있습니다.

![화면 구성](${img1})

## 위치(메뉴 경로)

PMS > 객실관리 > 실시간 객실(오늘)

## 항목 설명

### 상단 검색 필터

| 항목 | 설명 |
|---|---|
| 객실 상태 | 11종 상태로 필터 (공실/재실/대실/예약확정 등) |
| 객실 타입 | 숙소에 설정된 타입별 선별 조회 |
| 객실 층 | 층별 객실 조회 |
| 객실 수 | 현재 필터가 적용된 객실 수 총합 |

### 하단 카드형 객실정보

| 항목 | 설명 |
|---|---|
| 호실 | 객실 번호 |
| 현 상태 | 11종 상태 중 현재 상태 |
| 투숙기간 | 체크인 ~ 체크아웃 일자 |
| 투숙자명 | 대표 게스트명 |

### 객실 상태 11종

| 상태 | 의미 |
|---|---|
| 공실 | 비어있는 객실 |
| 재실 | 투숙중인 객실 |
| 대실 | 시간제로 사용중인 객실 |
| 예약확정 | 예약이 확정된 경우 |
| 예약보류 | 재고에 포함되는 상태 |
| 예약대기 | 재고에 포함되지 않는 상태 |
| 퇴실예정 | 금일 체크아웃 예정 |
| 퇴실요청 | 폰키로 고객이 체크아웃 버튼 클릭 |
| 청소요청 | 체크아웃 후 청소 필요 (=Dirty) |
| 청소요청(폰키) | 폰키로 고객이 청소요청 버튼 클릭 |
| O.O.O | 객실정비 등 판매 중지 |

![객실 상태 색상](${img2})

## 관련 문서

- 실시간 객실(오늘)에서 객실 상태 빠르게 변경하기 (howto)
- 청소요청(폰키) 상태값이 화면에 안 보일 때 (troubleshoot)
- 예약등록 — 카드 클릭 시 이동
- 체크인/아웃 — 재실 카드 클릭 시 이동
`,
  },
  {
    productCode: PRODUCT,
    contentType: 'howto',
    categoryPath: CATEGORY_PATH,
    title: '실시간 객실(오늘)에서 객실 상태 빠르게 변경하기',
    summary:
      '우클릭/좌클릭으로 객실 상태를 즉시 변경하고, 카드 클릭으로 예약등록·체크인 화면으로 이동하는 방법입니다.',
    keywords: ['실시간객실', '상태변경', '우클릭', '청소요청', '빠른변경'],
    bodyMarkdown: `## 목표

실시간 객실(오늘) 화면에서 마우스 클릭만으로 객실 상태를 즉시 변경하고, 후속 화면(예약등록·체크인/아웃)으로 빠르게 이동합니다.

## 사전 준비

- 권한: 호텔리어 이상
- 메뉴 경로: PMS > 객실관리 > 실시간 객실(오늘)
- 화면이 정상 로드되어 객실 카드가 보이는 상태

## 단계

1. **전체 현황 확인** — 상단 필터를 모두 풀어 전체 객실을 카드 형태로 띄웁니다.

2. **객실 상태 빠른 변경** — 카드 위에서 우클릭 또는 좌클릭으로 즉시 상태를 변경합니다.

   | 현재 상태 | 클릭 | 변경 후 |
   |---|---|---|
   | 재실 | 우클릭 | 청소요청/재실 |
   | 체크아웃(Dirty) | 우클릭 | 공실(Clean) |
   | 청소요청 | 좌클릭 | 공실(Clean) |
   | 청소요청 | 우클릭 | 점검(Inspect) |

3. **공실 카드 클릭** — \`예약등록\` 화면으로 이동합니다.

4. **재실 카드 클릭** — \`체크인/아웃\` 화면으로 이동합니다.

![사용 예시](${img3})

## 다음 단계

- 새 예약을 받았다면 → \`예약등록\`
- 체크아웃을 처리한 객실 일괄 마감은 → \`객실 일마감 > 일마감 사전체크\`
- 11종 상태값 의미가 헷갈리면 → \`실시간 객실(오늘) 화면 구성\` 참고
`,
  },
  {
    productCode: PRODUCT,
    contentType: 'troubleshoot',
    categoryPath: CATEGORY_PATH,
    title: '청소요청(폰키) 상태값이 화면에 안 보일 때',
    summary:
      '청소요청(폰키)는 키리스(폰키) 사용 숙소에만 표시됩니다. 미사용 숙소는 정상 동작이며 별도 조치 불필요.',
    keywords: ['폰키', '키리스', '청소요청', '상태값', '누락'],
    bodyMarkdown: `## 증상

실시간 객실(오늘) 화면에서 다른 숙소에는 보이는 **"청소요청(폰키)"** 상태값이 우리 숙소 화면에는 나타나지 않습니다. 필터에도 선택지로 보이지 않을 수 있습니다.

## 원인

1. **키리스(폰키) 프로그램 미사용** — 청소요청(폰키)는 키리스 모듈을 사용하는 숙소에만 자동 노출되는 상태값입니다. 키리스가 비활성이면 해당 상태가 발생하지 않으므로 화면 표기에서도 제외됩니다.

## 해결 단계

1. **키리스 도입 여부 확인** — 어드민의 모듈 설정에서 키리스(폰키)가 활성화돼 있는지 확인합니다.

2. **비활성 = 정상** — 키리스를 사용하지 않는 숙소라면 청소요청(폰키)가 안 보이는 것이 정상 동작입니다. 별도 조치 불필요.

3. **일반 청소요청은 정상 표시 확인** — 키리스 사용 여부와 무관하게 일반 "청소요청" 상태값은 동일하게 표시됩니다. 이게 안 보이면 별도 이슈로 봐야 합니다.

## 그래도 안 되면

- 키리스를 사용 중인데도 청소요청(폰키)가 안 보이는 경우 → AS 접수로 문의 (스크린샷 + 호텔 식별자 첨부)
- 키리스 도입을 검토 중이라면 → \`Keyless > OA 키리스\` 카테고리 참고
- 일반 "청소요청" 자체가 표시되지 않는 경우는 별도 트러블슈팅 필요
`,
  },
];

// ─────────────────────────────────────────────────────────────
// 3. 아티클 insert
// ─────────────────────────────────────────────────────────────

console.log('\n[2/2] 아티클 insert');
let created = 0;
let skipped = 0;
for (const spec of specs) {
  const r = await insertArticle(spec, authorId);
  if (r.ok) created++;
  else if (r.skipped) skipped++;
}

console.log(`\n✓ 완료: created=${created}, skipped=${skipped}`);
console.log('  확인 → /admin/articles (draft 필터)');
