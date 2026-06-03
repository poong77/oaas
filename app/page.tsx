/**
 * LP-01 통합 홈 — Phase 2.
 *
 * 구성 (2026-06-01 UX 재구성):
 *   ① Hero (좌: 검색 / 우: 서비스 상태 + 최근 업데이트 박스) — 기존 유지
 *   ② 빠른 행동 2갈래 택1 (답 찾기 /search · 문의하기 /tickets/new) + 내 문의 보조링크
 *   ③ 제품으로 찾기 (/help) · ④ 역할로 찾기 (/role) — 두 섹션 분리
 *   (푸터 연락 정보/약관은 RoleScope의 ContactPanel + SiteFooter로 통합 — 별도 렌더 없음)
 *
 * 변경 이력:
 *   - 2026-05-29: 서비스 상태/최근 업데이트를 Hero 우측 박스로 통합. 하단 중복 섹션 제거.
 *   - 2026-05-30: HomeFooter 제거 → 글로벌 SiteFooter(RoleScope)로 이전.
 *   - 2026-06-01: UX 재구성. 자주찾는작업·CTA → 빠른행동 2갈래로 통합(접수 동선 단일화),
 *                 카테고리+역할 → 탭 병합. 계정 작업은 프로필로 이동.
 *
 * DB 호출이 있으므로 force-dynamic.
 */

import { getProductCategories } from '@/lib/services/categories';
import { getLatestServiceStatus } from '@/lib/services/service-status';
import { listActiveRoleStarters } from '@/lib/services/master-role-starters';
import { resolvePopularKeywords } from '@/lib/services/master-popular-keywords';
import { getCurrentUser, isManagerOrAdmin } from '@/lib/permissions';
import { listActivePopupNotices } from '@/lib/services/notices';
import { HomePopupBanner } from '@/components/notices/home-popup-banner';
import { HomeHero } from './_components/home/home-hero';
import { HomeStatusUpdatesBox } from './_components/home/home-status-updates-box';
import { HomeQuickChoice } from './_components/home/home-quick-choice';
import { CategoryGrid } from './_components/home/category-grid';
import { RoleStarters } from './_components/home/role-starters';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: '통합 AS 플랫폼 — support.oapms.com',
  description:
    'OA PMS · CMS · Keyless · 키오스크 · 웹서비스 통합 셀프 서비스 + AS 티켓 허브',
};

export default async function HomePage() {
  const [
    categories,
    latestStatus,
    roleStarterRows,
    popupNotices,
    keywords,
    currentUser,
  ] = await Promise.all([
    getProductCategories(),
    getLatestServiceStatus(),
    listActiveRoleStarters(),
    listActivePopupNotices(),
    resolvePopularKeywords(),
    getCurrentUser(),
  ]);
  const canManageKeywords = !!currentUser && isManagerOrAdmin(currentUser.role);

  return (
    <>
      <HomePopupBanner notices={popupNotices} />
      <HomeHero
        keywords={keywords}
        canManage={canManageKeywords}
        sidebar={
          /* HomeStatusUpdatesBox는 async 서버 컴포넌트 — JSX로 직접 전달 */
          <HomeStatusUpdatesBox latest={latestStatus} />
        }
      />
      <HomeQuickChoice />
      <CategoryGrid categories={categories} />
      <RoleStarters items={roleStarterRows} />
    </>
  );
}
