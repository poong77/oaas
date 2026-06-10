/**
 * LegalPage — 약관/개인정보 등 정책 문서 공용 레이아웃 시안.
 * 공용 헤더(public)/푸터 + 본문(섹션 목록).
 */
import { LandingHeader } from './landing-header';
import { LandingFooter } from './landing-footer';

export type LegalSection = { heading: string; body: string[] };

export function LegalPage({
  title,
  updatedAt,
  sections,
}: {
  title: string;
  updatedAt: string;
  sections: LegalSection[];
}) {
  return (
    <div className="min-h-screen bg-white font-sans text-[#1A1C20]">
      <LandingHeader variant="public" />

      <main className="mx-auto max-w-[800px] px-5 py-12">
        <h1 className="text-[28px] font-bold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-[#868B94]">시행일 {updatedAt}</p>

        <div className="mt-8 flex flex-col gap-8">
          {sections.map((s, i) => (
            <section key={i}>
              <h2 className="mb-2 text-lg font-bold text-[#1A1C20]">
                {s.heading}
              </h2>
              <div className="flex flex-col gap-2">
                {s.body.map((p, j) => (
                  <p key={j} className="text-sm leading-relaxed text-[#3F4651]">
                    {p}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>

      <LandingFooter />
    </div>
  );
}
