'use server';

import { listArticles, type ArticleListItem } from '@/lib/services/articles';

/**
 * 제품 가이드 목록 — 검색/무한스크롤용 페이지 패치.
 *
 * - q가 있으면 선택 카테고리(selectedPath)에 갇히지 않고 제품 전체에서 검색한다
 *   (검색 결과가 "안 나온다"고 느껴지지 않도록).
 * - 정렬은 최신 발행순 고정.
 */
export async function fetchProductArticles(input: {
  productCode: string;
  q?: string;
  selectedPath?: string[];
  page: number;
  pageSize: number;
}): Promise<{ items: ArticleListItem[]; total: number }> {
  const q = input.q?.trim() || undefined;
  const { items, total } = await listArticles({
    productCode: input.productCode,
    q,
    publishedOnly: true,
    selectedPath: q ? undefined : input.selectedPath,
    sortBy: 'published_at',
    sortOrder: 'desc',
    page: input.page,
    pageSize: input.pageSize,
  });
  return { items, total };
}
