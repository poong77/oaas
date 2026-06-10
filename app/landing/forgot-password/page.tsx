/**
 * /landing/forgot-password — 비밀번호 찾기 시안.
 *
 * 기존 (auth)/forgot-password UI(AC-11 다단계 Card)를 그대로 시안화한 ForgotPasswordForm 사용.
 * 공용 헤더(public) + 공용 푸터로 감싸고 카드만 중앙 배치.
 */
import { LandingHeader } from '../_components/landing-header';
import { LandingFooter } from '../_components/landing-footer';
import { ForgotPasswordForm } from '../_components/forgot-password-form';

export const metadata = {
  title: '비밀번호 찾기 — OA서포트',
};

export default function LandingForgotPasswordPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#F3F4F5] font-sans text-[#1A1C20]">
      <LandingHeader variant="public" />
      <main className="flex flex-1 items-start justify-center px-5 py-16 sm:py-24">
        <ForgotPasswordForm />
      </main>
      <LandingFooter />
    </div>
  );
}
