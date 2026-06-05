/**
 * 지식팩 로컬 생성 — CB-05 (오프라인/검수용).
 *
 * 실행: `npm run export:knowledge` 또는 `npx tsx db/export-knowledge.ts [productCode]`
 *   - DATABASE_URL 필요 (.env.local / .env).
 *   - 발행 아티클 + 활성 FAQ + 활성 동의어를 Markdown / JSONL로 디스크에 저장.
 *   - 출력: 프로젝트 루트 `oa-knowledge[-product]-YYYY-MM-DD.{md,jsonl}`
 *
 * 서버 라우트(/api/admin/knowledge-export)와 동일한 포맷 모듈을 공유한다.
 * (server-only인 buildKnowledgePack 대신, 여기서 동일 쿼리를 직접 수행)
 */

import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { connectPg } from './connect';
import { and, asc, eq } from 'drizzle-orm';

import {
  articles,
  categories,
  faqs,
  termGroups,
  termSynonyms,
} from './schema';
import {
  CONTENT_TYPE_LABEL,
  PUBLIC_BASE_URL,
  TERM_CATEGORY_LABEL,
  toJsonl,
  toMarkdown,
  normalizeBody,
  type ArticleKnowledge,
  type FaqKnowledge,
  type KnowledgePack,
  type SynonymKnowledge,
} from '../lib/services/knowledge-export-format';

const DATABASE_URL = process.env.DATABASE_URL ?? '';
const productFilter = process.argv[2]?.trim() || undefined;

async function main() {
  if (!DATABASE_URL) {
    console.error('✗ DATABASE_URL이 설정되지 않았습니다 (.env.local / .env 확인)');
    process.exit(1);
  }
  const { db } = connectPg(DATABASE_URL);

  // 제품 라벨 맵
  const productRows = await db
    .select({ code: categories.code, label: categories.label })
    .from(categories)
    .where(and(eq(categories.type, 'product'), eq(categories.isActive, true)));
  const labelMap = new Map(productRows.map((p) => [p.code, p.label]));
  const labelOf = (code: string) => labelMap.get(code) ?? code;

  // 아티클 (발행 + 활성)
  const articleConds = [
    eq(articles.status, 'published'),
    eq(articles.isActive, true),
  ];
  if (productFilter) articleConds.push(eq(articles.productCode, productFilter));
  const articleRows = await db
    .select({
      id: articles.id,
      slug: articles.slug,
      productCode: articles.productCode,
      contentType: articles.contentType,
      categoryPath: articles.categoryPath,
      appliesTo: articles.appliesTo,
      keywords: articles.keywords,
      title: articles.title,
      summary: articles.summary,
      bodyMarkdown: articles.bodyMarkdown,
    })
    .from(articles)
    .where(and(...articleConds))
    .orderBy(asc(articles.productCode), asc(articles.publishedAt));

  const articleKnowledge: ArticleKnowledge[] = articleRows.map((a) => ({
    id: a.id,
    slug: a.slug,
    productCode: a.productCode,
    productLabel: labelOf(a.productCode),
    contentType: a.contentType,
    contentTypeLabel: CONTENT_TYPE_LABEL[a.contentType],
    categoryPath: a.categoryPath ?? [],
    appliesToFeature: a.appliesTo?.feature ?? null,
    keywords: a.keywords ?? [],
    title: a.title,
    summary: a.summary,
    url: `${PUBLIC_BASE_URL}/help/${a.productCode}/${a.contentType}/${a.slug}`,
    content: normalizeBody(a.bodyMarkdown),
  }));

  // FAQ (활성)
  const faqConds = [eq(faqs.isActive, true)];
  if (productFilter) faqConds.push(eq(faqs.productCode, productFilter));
  const faqRows = await db
    .select({
      id: faqs.id,
      productCode: faqs.productCode,
      issueType: faqs.issueType,
      keywords: faqs.keywords,
      question: faqs.question,
      answerMarkdown: faqs.answerMarkdown,
    })
    .from(faqs)
    .where(and(...faqConds))
    .orderBy(asc(faqs.productCode), asc(faqs.sortOrder));

  const faqKnowledge: FaqKnowledge[] = faqRows.map((f) => ({
    id: f.id,
    productCode: f.productCode,
    productLabel: labelOf(f.productCode),
    issueType: f.issueType,
    keywords: f.keywords ?? [],
    question: f.question,
    answer: normalizeBody(f.answerMarkdown),
  }));

  // 동의어
  const groupRows = await db
    .select({
      id: termGroups.id,
      canonicalTerm: termGroups.canonicalTerm,
      category: termGroups.category,
    })
    .from(termGroups)
    .where(eq(termGroups.isActive, true))
    .orderBy(asc(termGroups.category), asc(termGroups.sortOrder));
  const synonymRows = await db
    .select({ groupId: termSynonyms.groupId, term: termSynonyms.term })
    .from(termSynonyms)
    .where(eq(termSynonyms.isActive, true))
    .orderBy(asc(termSynonyms.sortOrder), asc(termSynonyms.term));

  const variantsByGroup = new Map<string, string[]>();
  for (const s of synonymRows) {
    const arr = variantsByGroup.get(s.groupId) ?? [];
    arr.push(s.term);
    variantsByGroup.set(s.groupId, arr);
  }
  let synonymTermCount = 0;
  const synonymKnowledge: SynonymKnowledge[] = groupRows.map((g) => {
    const variants = (variantsByGroup.get(g.id) ?? []).filter(
      (t) => t.trim() && t.trim() !== g.canonicalTerm.trim(),
    );
    synonymTermCount += variants.length;
    return {
      canonical: g.canonicalTerm,
      category: g.category,
      categoryLabel: TERM_CATEGORY_LABEL[g.category],
      variants,
    };
  });

  const pack: KnowledgePack = {
    generatedAt: new Date(),
    productCode: productFilter ?? null,
    productLabel: productFilter ? labelOf(productFilter) : null,
    synonyms: synonymKnowledge,
    articles: articleKnowledge,
    faqs: faqKnowledge,
    stats: {
      articleCount: articleKnowledge.length,
      faqCount: faqKnowledge.length,
      synonymGroupCount: synonymKnowledge.length,
      synonymTermCount,
    },
  };

  const stamp = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
  const scope = productFilter ? `-${productFilter}` : '';
  const mdPath = resolve(process.cwd(), `oa-knowledge${scope}-${stamp}.md`);
  const jsonlPath = resolve(process.cwd(), `oa-knowledge${scope}-${stamp}.jsonl`);

  writeFileSync(mdPath, toMarkdown(pack), 'utf8');
  writeFileSync(jsonlPath, toJsonl(pack), 'utf8');

  console.log('✓ 지식팩 생성 완료');
  console.log(
    `  범위: ${pack.productLabel ? `${pack.productLabel} (${productFilter})` : '전체 제품'}`,
  );
  console.log(
    `  구성: 아티클 ${pack.stats.articleCount} · FAQ ${pack.stats.faqCount} · 동의어 그룹 ${pack.stats.synonymGroupCount}(이형어 ${pack.stats.synonymTermCount})`,
  );
  console.log(`  MD   : ${mdPath}`);
  console.log(`  JSONL: ${jsonlPath}`);
}

main().catch((err) => {
  console.error('✗ 지식팩 생성 실패:', err);
  process.exit(1);
});
