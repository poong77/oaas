/**
 * /landing/notices — 공지사항 목록 화면 시안 (Figma node 43:72).
 *
 * 필터 탭(전체/공지사항/서비스 장애/릴리즈) + 검색 + 리스트 + 페이지네이션.
 * 공용 헤더(authed)/푸터 재사용.
 */
import { LandingNoticesView } from '../_components/landing-notices-view';

export const metadata = {
  title: '공지사항 — OA서포트',
};

export default function LandingNoticesPage() {
  return <LandingNoticesView />;
}
