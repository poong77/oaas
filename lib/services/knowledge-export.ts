/**
 * CB-05 — 지식팩 내보내기 (데이터 로드, server-only).
 *
 * 발행 아티클 + 활성 FAQ + 활성 동의어를 DB에서 모아 KnowledgePack을 구성한다.
 * 순수 포맷 로직(정규화·Markdown·JSONL)은 `knowledge-export-format.ts` 참조.
 *
 * 설계 원칙:
 *   - RAG 실시간 검색과 별개로, 챗봇에 "직접 먹일" 지식 스냅샷을 생성.
 *   - 본문 정규화로 레이아웃 노이즈 제거 → 토큰 효율 + 인식률 향상.
 *   - 동의어를 "용어 사전"으로 인라인 → 모델이 구어체를 표준어로 매핑.
 *   - 각 항목을 self-contained 청크로 → RAG 분리 시에도 문맥 보존.
 *
 * @see docs/IMPLEMENTATION_PLAN.md §2-b CB-05
 */

import 'server-only';
import { and, asc, eq } from 'drizzle-orm';

import { db } from '@/db';
import { articles, faqs, termGroups, termSynonyms } from '@/db/schema';
import { getProductCategories } from '@/lib/services/categories';
import {
  CONTENT_TYPE_LABEL,
  PUBLIC_BASE_URL,
  TERM_CATEGORY_LABEL,
  type ArticleKnowledge,
  type FaqKnowledge,
  type KnowledgePack,
  type SynonymKnowledge,
  normalizeBody,
} from '@/lib/services/knowledge-export-format';

// 포맷 빌더/타입 재노출 (route handler·page에서 단일 진입점으로 import 가능)
export {
  toJsonl,
  toMarkdown,
  normalizeBody,
  type KnowledgePack,
  type ArticleKnowledge,
  type FaqKnowledge,
  type SynonymKnowledge,
} from '@/lib/services/knowledge-export-format';

export type KnowledgeExportOptions = {
  /** 특정 제품 코드만. 미지정 시 전체. */
  productCode?: string;
};

/**
 * 발행 아티클 + 활성 FAQ + 활성 동의어를 모아 KnowledgePack 구성.
 *
 * graceful degrade: DB 미연결 시 빈 팩 반환.
 */
export async function buildKnowledgePack(
  options: KnowledgeExportOptions = {},
): Promise<KnowledgePack> {
  const productCode = options.productCode?.trim() || undefined;
  const empty: KnowledgePack = {
    generatedAt: new Date(),
    productCode: productCode ?? null,
    productLabel: null,
    synonyms: [],
    articles: [],
    faqs: [],
    stats: {
      articleCount: 0,
      faqCount: 0,
      synonymGroupCount: 0,
      synonymTermCount: 0,
    },
  };
  if (!db) return empty;

  try {
    // 제품 라벨 맵
    const products = await getProductCategories();
    const productLabelMap = new Map(products.map((p) => [p.code, p.label]));
    const labelOf = (code: string) => productLabelMap.get(code) ?? code;

    // 아티클 (발행 + 활성)
    const articleConds = [
      eq(articles.status, 'published'),
      eq(articles.isActive, true),
    ];
    if (productCode) articleConds.push(eq(articles.productCode, productCode));
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
        publishedAt: articles.publishedAt,
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
    if (productCode) faqConds.push(eq(faqs.productCode, productCode));
    const faqRows = await db
      .select({
        id: faqs.id,
        productCode: faqs.productCode,
        issueType: faqs.issueType,
        keywords: faqs.keywords,
        question: faqs.question,
        answerMarkdown: faqs.answerMarkdown,
        sortOrder: faqs.sortOrder,
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

    // 동의어 (활성 그룹 + 활성 이형어) — 제품 필터와 무관하게 전체 (질문 해석 보조)
    const groupRows = await db
      .select({
        id: termGroups.id,
        canonicalTerm: termGroups.canonicalTerm,
        category: termGroups.category,
        sortOrder: termGroups.sortOrder,
      })
      .from(termGroups)
      .where(eq(termGroups.isActive, true))
      .orderBy(
        asc(termGroups.category),
        asc(termGroups.sortOrder),
        asc(termGroups.canonicalTerm),
      );
    const synonymRows = await db
      .select({
        groupId: termSynonyms.groupId,
        term: termSynonyms.term,
        sortOrder: termSynonyms.sortOrder,
      })
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
      // canonical과 중복되는 이형어는 제거
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

    return {
      generatedAt: new Date(),
      productCode: productCode ?? null,
      productLabel: productCode ? labelOf(productCode) : null,
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
  } catch (err) {
    console.error('[knowledge-export.buildKnowledgePack] 실패:', err);
    return empty;
  }
}
