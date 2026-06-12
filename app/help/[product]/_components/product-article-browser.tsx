'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Search, X, Loader2, BookOpen } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Card, CardContent } from '@/components/ui/card';
import type { ArticleListItem } from '@/lib/services/articles';
import { fetchProductArticles } from '../_actions';
import { ProductArticleCards } from './product-article-cards';

/**
 * 제품 가이드 목록 브라우저 — 좌측 사이드바(검색+카테고리) + 우측 무한스크롤 리스트.
 *
 * - 검색: 입력 즉시(디바운스 300ms) 서버액션으로 재조회 → URL 이동 없이 실시간.
 * - 무한스크롤: 하단 센티넬이 보이면 다음 페이지를 이어 붙인다.
 * - 카테고리 변경(selectedPath)은 URL 이동 → 서버 재렌더 → key로 이 컴포넌트 리셋.
 */
export function ProductArticleBrowser({
  productCode,
  productLabel,
  selectedPath,
  initialItems,
  initialTotal,
  pageSize,
  sidebarExtra,
}: {
  productCode: string;
  productLabel: string;
  selectedPath: string[];
  initialItems: ArticleListItem[];
  initialTotal: number;
  pageSize: number;
  sidebarExtra: ReactNode;
}) {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<ArticleListItem[]>(initialItems);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  // 검색어가 비어있는 초기 상태인지 — 첫 마운트 시 불필요한 재조회 방지.
  const isInitial = q.trim() === '' && page === 1 && !searching;

  const hasMore = items.length < total;
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  // 비동기 응답 경쟁 방지: 최신 요청만 반영.
  const reqIdRef = useRef(0);

  // 검색어 디바운스 → page 1부터 재조회.
  useEffect(() => {
    const term = q.trim();
    // 초기(빈 검색어) 상태로 되돌아오면 서버가 준 초기 목록 그대로 사용.
    if (term === '') {
      // 진행 중이던 검색/추가로드 응답을 무효화하고 초기 목록으로 복귀.
      ++reqIdRef.current;
      setSearching(false);
      setItems(initialItems);
      setTotal(initialTotal);
      setPage(1);
      return;
    }
    setSearching(true);
    const reqId = ++reqIdRef.current;
    const timer = setTimeout(async () => {
      setLoading(true);
      const res = await fetchProductArticles({
        productCode,
        q: term,
        selectedPath,
        page: 1,
        pageSize,
      });
      if (reqId === reqIdRef.current) {
        setItems(res.items);
        setTotal(res.total);
        setPage(1);
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
    // initialItems/initialTotal은 의도적으로 의존성에서 제외(검색 중 덮어쓰기 방지).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, productCode, pageSize, selectedPath]);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    const reqId = reqIdRef.current; // 검색 변경 없이 이어붙이는 경우만 유효.
    setLoading(true);
    const nextPage = page + 1;
    const res = await fetchProductArticles({
      productCode,
      q: q.trim() || undefined,
      selectedPath,
      page: nextPage,
      pageSize,
    });
    if (reqId === reqIdRef.current) {
      setItems((prev) => [...prev, ...res.items]);
      setTotal(res.total);
      setPage(nextPage);
      setLoading(false);
    } else {
      setLoading(false);
    }
  }, [loading, hasMore, page, productCode, q, selectedPath, pageSize]);

  // 무한스크롤 옵저버.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: '400px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore]);

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <aside className="flex flex-col gap-4">
        {/* 카테고리 박스 바로 위 — 제품 내 검색 (실시간) */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="이 제품 안에서 검색"
            className="pl-8 pr-8"
            aria-label="이 제품 안에서 검색"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
              aria-label="검색어 지우기"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {/* 카테고리 트리 + 다른 제품 — 검색 중에는 가려 혼동 방지 */}
        <div className={isInitial ? '' : 'hidden lg:block'}>{sidebarExtra}</div>
      </aside>

      <Card>
        <CardContent className="p-0">
          {items.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={<BookOpen className="h-6 w-6" />}
                title={
                  q.trim()
                    ? '검색 결과가 없습니다'
                    : `${productLabel} 아티클이 아직 없습니다`
                }
                description={
                  q.trim()
                    ? '다른 키워드로 시도하거나 문의로 접수해주세요.'
                    : '곧 핸드북이 추가될 예정입니다. 급한 문의는 아래 버튼을 이용하세요.'
                }
                action={
                  <Button asChild size="sm">
                    <Link href={`/tickets/new?product=${productCode}`}>
                      {productLabel} 문의하기
                    </Link>
                  </Button>
                }
              />
            </div>
          ) : (
            <>
              <ProductArticleCards items={items} productCode={productCode} />
              {/* 무한스크롤 센티넬 + 로딩/끝 표시 */}
              <div
                ref={sentinelRef}
                className="flex items-center justify-center py-5 text-xs text-slate-400 dark:text-slate-500"
              >
                {loading ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    불러오는 중…
                  </span>
                ) : hasMore ? (
                  <span>스크롤하여 더 보기</span>
                ) : (
                  <span>총 {total}건 — 마지막입니다</span>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
