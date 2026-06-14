/**
 * LP-01 통합 홈 — 시안 구조 재편 (2026-06-10, B안).
 *
 * 구성:
 *   ① HomePopupBanner (팝업 공지)
 *   ② Hero — "무엇을 도와드릴까요?" + 통합검색 + 인기검색어 (중앙 정렬)
 *   ③ 카테고리 찾아보기 — 제품별/역할별 탭 (CategoryTabs)
 *   ④ 공지사항 — 최근 발행 공지 리스트 (HomeNoticeList)
 *   ⑤ CTA — 1:1 문의 유도 (HomeHelpCta)
 *   (고객센터/연락처·푸터는 전역 RoleScope의 ContactPanel + SiteFooter가 담당)
 *
 * 전역 크롬(RoleScope) 유지 + 본문만 시안 디자인으로 교체. 컬러는 brand-* 토큰(역할별 동적).
 * DB 호출이 있으므로 force-dynamic.
 */

import {
  getProductCategories,
  getCategoriesByType,
} from '@/lib/services/categories';
import { listActiveRoleStarters } from '@/lib/services/master-role-starters';
import { resolvePopularKeywords } from '@/lib/services/master-popular-keywords';
import {
  listActivePopupNotices,
  listRecentPublishedNotices,
} from '@/lib/services/notices';
import { listTickets, countTicketsByStatus } from '@/lib/services/tickets';
import type { UserRole } from '@/db/schema';
import { getCurrentUser, isManagerOrAdmin } from '@/lib/permissions';
import { HomePopupBanner } from '@/components/notices/home-popup-banner';
import { HomeHero } from './_components/home/home-hero';
import { CategoryTabs } from './_components/home/category-tabs';
import { HomeNoticeList } from './_components/home/home-notice-list';
import { HomeHelpCta } from './_components/home/home-help-cta';
import { HomeMyTickets } from './_components/home/home-my-tickets';

/** 로그인 사용자의 '내 문의' 데이터(상태 요약 + 최근 5건). */
async function loadMyTickets(user: {
  id: string;
  role: UserRole;
  hotelId: string | null;
}) {
  const filter =
    user.role === 'hotelier' && user.hotelId
      ? { hotelId: user.hotelId }
      : { reporterId: user.id };
  const viewer = { id: user.id, role: user.role, hotelId: user.hotelId };
  const [recent, counts, productCats, issueCats] = await Promise.all([
    listTickets({ ...filter, sortBy: 'created_at', sortOrder: 'desc', pageSize: 5 }, viewer),
    countTicketsByStatus(filter),
    getCategoriesByType('product'),
    getCategoriesByType('issue_type'),
  ]);
  const productMap = Object.fromEntries(productCats.map((c) => [c.code, c.label]));
  const issueMap = Object.fromEntries(issueCats.map((c) => [c.code, c.label]));
  return { counts, items: recent.items, productMap, issueMap };
}

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'OA서포트 — support.oapms.com',
  description:
    'OA PMS · CMS · Keyless · 키오스크 · 웹서비스 통합 셀프 서비스 + AS 티켓 허브',
};

export default async function HomePage() {
  const [
    categories,
    roleStarters,
    popupNotices,
    keywords,
    recentNotices,
    currentUser,
  ] = await Promise.all([
    getProductCategories(),
    listActiveRoleStarters(),
    listActivePopupNotices(),
    resolvePopularKeywords(),
    listRecentPublishedNotices(5),
    getCurrentUser(),
  ]);
  const canManageKeywords = !!currentUser && isManagerOrAdmin(currentUser.role);

  // 로그인 사용자 — 내 문의 섹션 데이터
  const myTickets = currentUser
    ? await loadMyTickets({
        id: currentUser.id,
        role: currentUser.role,
        hotelId: currentUser.hotelId ?? null,
      })
    : null;

  return (
    <>
      <HomePopupBanner notices={popupNotices} />
      <HomeHero keywords={keywords} canManage={canManageKeywords} />
      <CategoryTabs categories={categories} roles={roleStarters} />
      {myTickets && (
        <HomeMyTickets
          counts={myTickets.counts}
          items={myTickets.items}
          productMap={myTickets.productMap}
          issueMap={myTickets.issueMap}
        />
      )}
      {/* 도움말 CTA 배너는 비로그인 사용자에게만 노출 (로그인 시 '내 문의'로 대체) */}
      {!currentUser && <HomeHelpCta />}
      <HomeNoticeList items={recentNotices} />
    </>
  );
}
