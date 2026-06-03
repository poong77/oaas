/**
 * 일회성 마이그레이션 — 아티클 본문의 평문 "## 관련 문서" 섹션 제거.
 *
 * 배경:
 *   - 콘텐츠 이관 시 본문 끝에 손으로 쓴 "## 관련 문서" 불릿 목록이 들어갔는데,
 *     평문이라 링크가 없고 제목과 1:1로 안 맞음(매칭률 6.2%).
 *   - /help 상세 페이지는 이미 컴포넌트가 링크되는 "관련 문서" 카드를 렌더
 *     (relatedArticleIds 또는 같은 제품군 fallback).
 *   - 따라서 본문 평문 섹션은 중복 + 무링크 → 제거하고 컴포넌트 링크 카드만 남긴다.
 *
 * 동작:
 *   - "## 관련 문서" 헤딩부터 다음 H1/H2 헤딩(또는 EOF)까지 제거.
 *   - TOC 재추출(헤딩 제거 반영). updated_at은 $onUpdate 자동.
 *   - 멱등: 다시 실행하면 0건.
 *
 * 실행: npx tsx db/strip-related-docs-section.ts        (적용)
 *       npx tsx db/strip-related-docs-section.ts --dry   (미리보기)
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { eq } from 'drizzle-orm';

import { articles } from './schema';
import { extractToc } from '@/lib/articles/toc-extractor';

const DRY = process.argv.includes('--dry');

/**
 * 본문에서 "## 관련 문서" 섹션(헤딩 + 다음 H1/H2 직전까지)을 제거.
 * @returns 변경된 본문 (변경 없으면 원본 그대로)
 */
function stripRelatedSection(body: string): string {
  const lines = body.split('\n');
  // "## 관련 문서" 헤딩 라인 인덱스 (코드블록 밖)
  let start = -1;
  let inCode = false;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i]!.trim();
    if (t.startsWith('```')) {
      inCode = !inCode;
      continue;
    }
    if (inCode) continue;
    if (/^#{1,3}\s+관련\s*문서\s*$/.test(t)) {
      start = i;
      break;
    }
  }
  if (start < 0) return body;

  // 섹션 끝 = 다음 H1/H2 헤딩 (start 이후) 또는 EOF
  let end = lines.length;
  inCode = false;
  for (let i = start + 1; i < lines.length; i++) {
    const t = lines[i]!.trim();
    if (t.startsWith('```')) {
      inCode = !inCode;
      continue;
    }
    if (inCode) continue;
    if (/^#{1,2}\s+/.test(t)) {
      end = i;
      break;
    }
  }

  const next = [...lines.slice(0, start), ...lines.slice(end)];
  // 끝쪽 공백/구분선(---) 잔여 정리
  return next.join('\n').replace(/\s*\n\s*-{3,}\s*$/g, '').replace(/\n{3,}$/g, '\n').trimEnd() + '\n';
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL 없음');
  const db = drizzle(neon(url));

  const rows = await db
    .select({
      id: articles.id,
      slug: articles.slug,
      title: articles.title,
      body: articles.bodyMarkdown,
    })
    .from(articles);

  let changed = 0;
  for (const a of rows) {
    const stripped = stripRelatedSection(a.body);
    if (stripped === a.body) continue;
    changed++;
    if (DRY) {
      console.log(`· ${a.slug} (${a.title}) — ${a.body.length} → ${stripped.length}자`);
      continue;
    }
    const toc = extractToc(stripped);
    await db
      .update(articles)
      .set({ bodyMarkdown: stripped, toc })
      .where(eq(articles.id, a.id));
    console.log(`✅ ${a.slug} — 관련 문서 섹션 제거 + TOC 재추출`);
  }

  console.log(
    `\n${DRY ? '[DRY] ' : ''}대상 ${changed}건${DRY ? ' (적용하려면 --dry 빼고 실행)' : ' 처리 완료'}.`,
  );
  console.log('/help 상세는 force-dynamic이라 즉시 반영됩니다.');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
