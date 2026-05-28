'use client';

import { useEffect } from 'react';
import { bumpArticleViewCount } from '@/app/actions/article-actions';

/**
 * 아티클 상세 진입 시 view_count 1회 증가 (fire-and-forget).
 * 같은 페이지 내에서 articleId가 같으면 중복 호출 방지.
 *
 * 정밀 분석(visitor unique 등)은 Phase 5 article_views 테이블에서.
 */
export function ArticleViewTracker({ articleId }: { articleId: string }) {
  useEffect(() => {
    // 페이지가 실제 렌더된 다음 1회만
    void bumpArticleViewCount(articleId);
  }, [articleId]);
  return null;
}
