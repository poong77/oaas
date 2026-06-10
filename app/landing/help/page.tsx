/**
 * /landing/help — 제품별 가이드 목록(인덱스) 화면 시안.
 *
 * 좌측 카테고리 트리(전체/중분류·소분류 + 다른 제품) + 우측 아티클 카드 그리드.
 * 제품명·다른 제품 목록은 **마스터 제품 대분류**(getProductCategories)를 따른다.
 * 카드 클릭 → 상세 시안(/landing/guide).
 */
import { getProductCategories } from '@/lib/services/categories';
import { LandingHelpView } from '../_components/landing-help-view';

export const metadata = {
  title: '제품별 가이드 — OA서포트',
};

export const dynamic = 'force-dynamic';

export default async function LandingHelpPage() {
  const categories = await getProductCategories();
  const products = categories.map((c) => c.label);
  return <LandingHelpView products={products} />;
}
