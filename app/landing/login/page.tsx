/**
 * /landing/login — 로그인 화면 시안 (Figma node 22:11084).
 *
 * 구성: 공용 헤더 + 중앙 정렬 로그인 카드(이메일/아이디 · 비밀번호 · 로그인 버튼).
 * 배경 #F3F4F5. 자체 헤더를 가진 독립 시안(RoleScope 크롬 제외 — proxy + role-scope 처리).
 */
import { LandingHeader } from '../_components/landing-header';
import { LoginForm } from '../_components/login-form';

export const metadata = {
  title: '로그인 — OA서포트',
};

export default function LandingLoginPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#F3F4F5] font-sans text-[#1A1C20]">
      <LandingHeader variant="public" />

      <main className="flex flex-1 items-start justify-center px-5 py-16 sm:py-24">
        <div className="flex w-full max-w-[436px] flex-col items-center gap-6 rounded-xl bg-white p-8 sm:p-12">
          <h1 className="w-full text-center text-2xl font-bold text-black">로그인</h1>

          <LoginForm />
        </div>
      </main>
    </div>
  );
}
