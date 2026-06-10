/**
 * /landing/inquiry — 문의하기 화면 시안 (Figma node 36:509).
 *
 * 구성: 인증 헤더(LandingHeader authed) + 문의 접수 폼(문제분류·상세 내용·연락 방법) + 공용 푸터.
 * 배경 #F3F4F5. 자체 헤더를 가진 독립 시안(RoleScope 크롬 제외 — proxy + role-scope 처리).
 * 공개 접근: proxy.ts 의 /landing 하위 전체 공개 규칙으로 커버됨.
 */
import { LandingHeader } from '../_components/landing-header';
import { LandingFooter } from '../_components/landing-footer';
import { InquiryForm } from '../_components/inquiry-form';
import { listHotelierTemplates } from '@/lib/services/master-hotelier-templates';

export const metadata = {
  title: '문의하기 — OA서포트',
};

// DB(listHotelierTemplates) 호출 — 빌드 시 prerender 대신 요청 시 렌더.
export const dynamic = 'force-dynamic';

export default async function LandingInquiryPage() {
  const templates = await listHotelierTemplates();

  return (
    <div className="flex min-h-screen flex-col bg-[#F3F4F5] font-sans text-[#1A1C20]">
      <LandingHeader variant="authed" />
      <main className="flex-1 px-5 py-12 sm:py-16">
        <InquiryForm
          templates={templates.map((t) => ({
            id: t.id,
            title: t.title,
            content: t.content,
          }))}
        />
      </main>
      <LandingFooter />
    </div>
  );
}
