/**
 * LP-01 통합 홈 — Phase 2.
 *
 * 9 섹션:
 *   ① Hero + 통합 검색
 *   ② 인기검색어 칩 (Hero 내부)
 *   ③ 카테고리 그리드 (DB product 6개)
 *   ④ 자주찾는작업 (하드코딩)
 *   ⑤ 역할별 시작하기 (하드코딩)
 *   ⑥ 서비스 상태 위젯 (DB)
 *   ⑦ 최근 업데이트 (EmptyState, Phase 7)
 *   ⑧ CTA 3개
 *   ⑨ 푸터
 *
 * DB 호출이 있으므로 force-dynamic. DB 미연결 시에는 fallback으로 렌더.
 */

import { getProductCategories } from '@/lib/services/categories';
import { getLatestServiceStatus } from '@/lib/services/service-status';
import { HomeHero } from './_components/home/home-hero';
import { CategoryGrid } from './_components/home/category-grid';
import { QuickActions } from './_components/home/quick-actions';
import { RoleStarters } from './_components/home/role-starters';
import { ServiceStatusWidget } from './_components/home/service-status-widget';
import { RecentUpdates } from './_components/home/recent-updates';
import { HomeCTA } from './_components/home/home-cta';
import { HomeFooter } from './_components/home/home-footer';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: '통합 AS 플랫폼 — support.oapms.com',
  description:
    'OA PMS · CMS · Keyless · 키오스크 · 웹서비스 통합 셀프 서비스 + AS 티켓 허브',
};

export default async function HomePage() {
  const [categories, latestStatus] = await Promise.all([
    getProductCategories(),
    getLatestServiceStatus(),
  ]);

  return (
    <>
      <HomeHero />
      <CategoryGrid categories={categories} />
      <QuickActions />
      <RoleStarters />
      <ServiceStatusWidget latest={latestStatus} />
      <RecentUpdates />
      <HomeCTA />
      <HomeFooter />
    </>
  );
}
