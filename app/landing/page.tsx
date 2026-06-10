/**
 * /landing — 로그인 전 통합 홈 신규 디자인 시안 (Figma: "로그인 전").
 *
 * 기존 app/page.tsx(전역 RoleScope 헤더/푸터 포함)와 별개의 독립 시안이다.
 * Figma node 1:16 레이아웃을 프로젝트 컨벤션(Next.js 15 + Tailwind 4)으로 변환.
 * 자체 헤더/푸터를 포함하므로 전역 RoleScope 크롬과 무관하게 단독 렌더된다.
 *
 * 공개 접근: proxy.ts PUBLIC_PATHS 에 '/landing' 등록 완료.
 */
import { LandingView } from './_components/landing-view';

export const metadata = {
  title: 'OA서포트 — support.oapms.com',
  description:
    'OA PMS · CMS · Keyless · 키오스크 · 웹서비스 통합 셀프 서비스 + AS 티켓 허브',
};

export default function LandingPage() {
  return <LandingView />;
}
