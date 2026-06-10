/**
 * /landing/home — 로그인 후 통합 홈 시안 (Figma node 22:9945).
 *
 * 구성: 인증 헤더(카테고리 메가메뉴 + 유저 드롭다운) + 히어로 검색 + 공지사항
 *       + 고객센터 + 내 문의(상태 요약·리스트) + 공용 푸터.
 * 자체 헤더를 가진 독립 시안(RoleScope 크롬 제외 — proxy + role-scope 처리).
 * 공개 접근: proxy.ts 의 /landing 하위 전체 공개 규칙으로 커버됨.
 */
import { HomeView } from '../_components/home-view';

export const metadata = {
  title: '홈 — OA서포트',
  description: 'OA PMS · CMS · Keyless · 키오스크 · 웹서비스 통합 셀프 서비스 + AS 티켓 허브',
};

export default function LandingHomePage() {
  return <HomeView />;
}
