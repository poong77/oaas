/**
 * /landing/mypage — 마이페이지 시안.
 *
 * 구성: 인증 헤더(LandingHeader authed) + 사이드바 3탭(내 정보·비밀번호 변경·직원 관리) + 공용 푸터.
 * 직원 관리 탭의 행 클릭 시 '직원정보 수정' 모달(Figma node 44:1674).
 * 자체 헤더를 가진 독립 시안(RoleScope 크롬 제외). 공개 접근: /landing 하위 공개 규칙.
 */
import { LandingHeader } from '../_components/landing-header';
import { LandingFooter } from '../_components/landing-footer';
import { MypageView } from '../_components/mypage-view';

export const metadata = {
  title: '마이페이지 — OA서포트',
};

export default function LandingMypagePage() {
  return (
    <div className="flex min-h-screen flex-col bg-white font-sans text-[#1A1C20]">
      <LandingHeader variant="authed" />
      <main className="flex-1 px-5 py-12 sm:py-16">
        <MypageView />
      </main>
      <LandingFooter />
    </div>
  );
}
