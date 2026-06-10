/**
 * /landing/guide — 제품별 가이드(문서) 화면 시안 (Figma node 30:76).
 *
 * 3컬럼 문서 레이아웃: 좌측 가이드 내비 트리 + 중앙 본문 + 우측 목차(TOC) + 1:1 문의 CTA.
 * 상단 제품 탭은 **마스터 제품 대분류**(getProductCategories) 라벨을 따른다.
 */
import { getProductCategories } from '@/lib/services/categories';
import { LandingGuideView } from '../_components/landing-guide-view';

export const metadata = {
  title: '제품별 가이드 — OA서포트',
};

export const dynamic = 'force-dynamic';

export default async function LandingGuidePage() {
  const categories = await getProductCategories();
  const products = categories.map((c) => c.label);
  return <LandingGuideView products={products} />;
}
