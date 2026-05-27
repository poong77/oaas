import Link from 'next/link';

export default function HomePage() {
  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-16 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-3">
        <span className="text-sm font-medium text-brand-600 dark:text-brand-400">
          support.oapms.com — Phase 0 셋업 완료
        </span>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          통합 AS 플랫폼
        </h1>
        <p className="max-w-2xl text-base text-slate-600 dark:text-slate-300">
          OA 솔루션(PMS · CMS · Keyless · 키오스크 · 웹서비스) 호텔리어를 위한
          통합 셀프 서비스 + AS 티켓 허브입니다. 현재는 프로젝트 셋업
          단계이며, Phase 1부터 실제 기능 개발이 시작됩니다.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <PhaseCard
          phase="Phase 0"
          title="프로젝트 셋업"
          desc="Next.js 15, Tailwind 4, Drizzle, 다크모드, ConfirmDialog 글로벌"
          status="완료"
        />
        <PhaseCard
          phase="Phase 1"
          title="인증·권한·프로필"
          desc="OA SSO, 호텔리어/매니저/어드민 권한, 계정 관리"
          status="대기"
        />
        <PhaseCard
          phase="Phase 2~10"
          title="MVP P1 35개 기능"
          desc="랜딩 → 셀프서치 → 셀프픽스 → 이슈 클레임 → 어드민 마스터"
          status="대기"
        />
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="font-medium">개발자 빠른 확인</p>
        <ul className="mt-2 list-inside list-disc space-y-1 text-slate-600 dark:text-slate-300">
          <li>
            헬스체크:{' '}
            <Link
              href="/api/health"
              className="text-brand-600 underline-offset-2 hover:underline dark:text-brand-400"
            >
              /api/health
            </Link>
          </li>
          <li>우상단 다크모드 토글 확인</li>
          <li>우상단 &ldquo;데모: ConfirmDialog&rdquo; 버튼 확인</li>
        </ul>
      </div>
    </section>
  );
}

function PhaseCard({
  phase,
  title,
  desc,
  status,
}: {
  phase: string;
  title: string;
  desc: string;
  status: '완료' | '진행중' | '대기';
}) {
  const statusClass =
    status === '완료'
      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
      : status === '진행중'
        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
  return (
    <article className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {phase}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusClass}`}
        >
          {status}
        </span>
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="text-sm text-slate-600 dark:text-slate-300">{desc}</p>
    </article>
  );
}
