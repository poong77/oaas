/**
 * LP-01 통합 홈 — Phase 2.
 *
 * 구성:
 *   ① Hero (좌: 검색 / 우: 서비스 상태 + 최근 업데이트 박스)
 *   ② 카테고리 그리드 (DB product)
 *   ③ 자주찾는작업 (DB)
 *   ④ 역할별 시작하기 (DB)
 *   ⑤ CTA 3개
 *   (푸터는 RoleScope의 글로벌 SiteFooter로 통합 — 별도 렌더 없음)
 *
 * 변경 이력:
 *   - 2026-05-29: 서비스 상태/최근 업데이트를 Hero 우측 박스로 통합. 하단 중복 섹션 제거.
 *   - 2026-05-30: HomeFooter 제거 → 글로벌 SiteFooter(RoleScope)로 이전.
 *
 * DB 호출이 있으므로 force-dynamic.
 */

import { getProductCategories } from '@/lib/services/categories';
import { getLatestServiceStatus } from '@/lib/services/service-status';
import { listVisibleQuickActions } from '@/lib/services/master-quick-actions';
import { listActiveRoleStarters } from '@/lib/services/master-role-starters';
import { HomeHero } from './_components/home/home-hero';
import { HomeStatusUpdatesBox } from './_components/home/home-status-updates-box';
import { CategoryGrid } from './_components/home/category-grid';
import { QuickActions } from './_components/home/quick-actions';
import { RoleStarters } from './_components/home/role-starters';
import { HomeCTA } from './_components/home/home-cta';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: '통합 AS 플랫폼 — support.oapms.com',
  description:
    'OA PMS · CMS · Keyless · 키오스크 · 웹서비스 통합 셀프 서비스 + AS 티켓 허브',
};

export default async function HomePage() {
  const [categories, latestStatus, quickActionRows, roleStarterRows] =
    await Promise.all([
      getProductCategories(),
      getLatestServiceStatus(),
      listVisibleQuickActions(),
      listActiveRoleStarters(),
    ]);

  return (
    <>
      <HomeHero
        sidebar={
          /* HomeStatusUpdatesBox는 async 서버 컴포넌트 — JSX로 직접 전달 */
          <HomeStatusUpdatesBox latest={latestStatus} />
        }
      />
      <CategoryGrid categories={categories} />
      <QuickActions items={quickActionRows} />
      <RoleStarters items={roleStarterRows} />
      <HomeCTA />
    </>
  );
}
