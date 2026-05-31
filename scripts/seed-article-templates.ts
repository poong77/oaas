/**
 * Article templates seed — 코드 상수 → DB 이관 (A1+).
 *
 * 실행:
 *   tsx scripts/seed-article-templates.ts
 *
 * 동작:
 *   - 코드 상수(`lib/articles/templates.ts`)에서 howto/feature/troubleshoot 골격 로드
 *   - DB에 이미 같은 content_type+version=1이 있으면 skip
 *   - 없으면 INSERT (version=1, is_active=true)
 *
 * 멱등(idempotent) — 여러 번 실행해도 안전.
 */

import 'dotenv/config';
import { and, eq } from 'drizzle-orm';

import { db } from '@/db';
import { articleTemplates } from '@/db/schema';
import {
  getArticleTemplate,
  ARTICLE_CONTENT_TYPES,
} from '@/lib/articles/templates';

async function main() {
  if (!db) {
    console.error('DB not ready. Check DATABASE_URL.');
    process.exit(1);
  }

  let created = 0;
  let skipped = 0;

  for (const contentType of ARTICLE_CONTENT_TYPES) {
    const existing = await db
      .select({ id: articleTemplates.id })
      .from(articleTemplates)
      .where(
        and(
          eq(articleTemplates.contentType, contentType),
          eq(articleTemplates.version, 1),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      console.log(`[skip] ${contentType} v1 already exists`);
      skipped += 1;
      continue;
    }

    const tpl = getArticleTemplate(contentType);
    await db.insert(articleTemplates).values({
      contentType,
      version: 1,
      bodyMarkdown: tpl.bodyMarkdown,
      outline: tpl.outline,
      hoverPreview: tpl.hoverPreview,
    });
    console.log(`[created] ${contentType} v1 (outline: ${tpl.outline.length} H2)`);
    created += 1;
  }

  console.log(`\n완료: created=${created}, skipped=${skipped}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
