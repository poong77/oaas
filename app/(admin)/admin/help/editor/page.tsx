import { requireRole } from '@/lib/permissions';
import { Card, CardContent } from '@/components/ui/card';

export const dynamic = 'force-dynamic';
export const metadata = { title: '리치 에디터 가이드 — 운영자' };

export default async function EditorHelpPage() {
  await requireRole(['manager', 'admin']);

  return (
    <div className="flex flex-col gap-5 py-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          리치 에디터 운영자 가이드
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          공지·아티클·FAQ·체크리스트·빠른답변·티켓 답변에서 사용하는 통합 에디터의 단축키·기능 안내입니다.
        </p>
      </header>

      <Card>
        <CardContent className="p-5">
          <h2 className="mb-2 text-lg font-semibold">단축키 (어드민·매니저)</h2>
          <p className="mb-3 text-xs text-slate-500">
            에디터 안에서 <kbd className={kbd}>F1</kbd> 또는 <kbd className={kbd}>Cmd + ?</kbd>로 언제든 도움말 모달을 열 수 있습니다.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <ShortcutCard
              title="저장·발송"
              entries={[
                ['Cmd / Ctrl + S', '임시 저장 (즉시 draft)'],
                ['Cmd / Ctrl + Enter', '저장 + 발송 (공개 답변)'],
                ['Cmd / Ctrl + Shift + Enter', '저장 + Slack 발송 (내부 메모)'],
              ]}
            />
            <ShortcutCard
              title="매니저 기능"
              entries={[
                ['Cmd / Ctrl + /', '빠른답변 패널 열기'],
                ['Ctrl + 1~9', '빠른답변 즉시 삽입 (패널에서)'],
              ]}
            />
            <ShortcutCard
              title="서식"
              entries={[
                ['Cmd / Ctrl + B', '굵게'],
                ['Cmd / Ctrl + I', '기울임'],
                ['Cmd / Ctrl + U', '밑줄'],
                ['Cmd / Ctrl + K', '링크 삽입/편집'],
                ['Cmd / Ctrl + E', '인라인 코드'],
                ['Cmd / Ctrl + Shift + C', '코드 블록'],
                ['Cmd / Ctrl + Alt + 1~3', '제목 1~3'],
                ['Cmd / Ctrl + Shift + 7', '번호 목록'],
                ['Cmd / Ctrl + Shift + 8', '글머리 목록'],
                ['Cmd / Ctrl + Shift + 9', '체크리스트'],
              ]}
            />
            <ShortcutCard
              title="편집"
              entries={[
                ['Cmd / Ctrl + Z', '실행 취소'],
                ['Cmd / Ctrl + Shift + Z', '재실행'],
                ['Tab / Shift + Tab', '목록 들여쓰기 / 내어쓰기'],
                ['Esc', '모달·메뉴 닫기'],
              ]}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <h2 className="mb-2 text-lg font-semibold">마크다운 자동 변환</h2>
          <p className="mb-3 text-xs text-slate-500">
            입력 시 자동으로 서식이 적용됩니다. 마우스 없이 빠른 입력에 활용하세요.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left dark:border-slate-700">
                  <th className="py-1.5 pr-3 font-semibold">입력</th>
                  <th className="py-1.5 font-semibold">결과</th>
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    ['# (공백)', '제목 1'],
                    ['## (공백)', '제목 2'],
                    ['### (공백)', '제목 3'],
                    ['**텍스트**', '굵게'],
                    ['*텍스트*', '기울임'],
                    ['`코드`', '인라인 코드'],
                    ['- (공백)', '글머리 목록'],
                    ['1. (공백)', '번호 목록'],
                    ['- [ ] (공백)', '체크리스트'],
                    ['> (공백)', '인용'],
                    ['```', '코드 블록'],
                    ['---', '구분선'],
                  ] as Array<[string, string]>
                ).map(([k, v]) => (
                  <tr key={k} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-1.5 pr-3 font-mono text-xs">{k}</td>
                    <td className="py-1.5">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <h2 className="mb-2 text-lg font-semibold">매니저 빠른답변 사용법</h2>
          <ol className="ml-5 list-decimal space-y-2 text-sm">
            <li>
              <strong>마스터 등록</strong>: <a href="/admin/master/quick-replies" className="text-brand-700 underline">/admin/master/quick-replies</a>에서 템플릿 추가.
            </li>
            <li>
              <strong>변수 치환</strong>: 본문에 <code className={code}>{`{{호텔명}}`}</code>, <code className={code}>{`{{호텔리어명}}`}</code>, <code className={code}>{`{{티켓번호}}`}</code>, <code className={code}>{`{{매니저명}}`}</code> 사용 시 매니저 발송 시점에 자동 치환.
            </li>
            <li>
              <strong>티켓 답변 화면에서 호출</strong>: <kbd className={kbd}>Cmd + /</kbd> 또는 우상단 <em>⚡ 빠른답변</em> 버튼.
            </li>
            <li>
              <strong>즉시 삽입</strong>: 패널 열린 상태에서 <kbd className={kbd}>Ctrl + 1~9</kbd>로 즐겨찾기 9개 즉시 삽입.
            </li>
            <li>
              <strong>검색</strong>: 제목·내용·카테고리에서 부분 일치 검색.
            </li>
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <h2 className="mb-2 text-lg font-semibold">이미지·첨부</h2>
          <ul className="ml-5 list-disc space-y-1.5 text-sm">
            <li>이미지: jpg / png / webp / gif / heic — 개당 10MB. 1600px 초과 시 자동 리사이즈 (JPEG 0.85).</li>
            <li>PDF: 개당 10MB. <em>(2026-05-29 시점 영상은 미지원)</em></li>
            <li>업로드 위치: Vercel Blob, public URL (hash 추측 불가).</li>
            <li>본문에서 이미지 삭제 → 저장 시 Blob에서도 자동 삭제 (lifecycle).</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <h2 className="mb-2 text-lg font-semibold">자동 저장 동작</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left dark:border-slate-700">
                  <th className="py-1.5 pr-3 font-semibold">트리거</th>
                  <th className="py-1.5 pr-3 font-semibold">저장 위치</th>
                  <th className="py-1.5 font-semibold">표시</th>
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    ['idle 2초', 'localStorage', '저장 중 ⠋'],
                    ['idle 30초', 'localStorage + 서버 draft', '저장됨 (방금 전)'],
                    ['Cmd / Ctrl + S', '서버 draft 즉시', '저장됨'],
                    ['저장·발행 버튼', '본 DB 컬럼 (최종)', '발행됨 + draft 자동 삭제'],
                  ] as Array<[string, string, string]>
                ).map(([t, p, d]) => (
                  <tr key={t} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-1.5 pr-3">{t}</td>
                    <td className="py-1.5 pr-3 text-slate-600 dark:text-slate-400">{p}</td>
                    <td className="py-1.5 text-xs">{d}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            ⚠ 페이지 재진입 시 draft가 있으면 <em>복구 / 폐기</em> 다이얼로그가 자동 노출됩니다.
            발행 성공 후에는 해당 draft가 자동 삭제되어 다음 진입 시 다이얼로그가 뜨지 않습니다.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <h2 className="mb-2 text-lg font-semibold">발송 동작</h2>
          <ul className="ml-5 list-disc space-y-1.5 text-sm">
            <li><strong>SMS</strong> (솔라피): 발송 직전 마크다운 → plain text 자동 변환. 매니저 답변 화면 하단 "SMS 발송 시 미리보기" 토글로 카운터·LMS 안내 확인 가능.</li>
            <li><strong>이메일</strong> (SES): 마크다운 → HTML 자동 변환. plain text fallback도 자동 생성.</li>
            <li><strong>Slack</strong> (Webhook): 마크다운 → Slack mrkdwn 자동 변환 (<code className={code}>**굵게**</code> → <code className={code}>*굵게*</code>, <code className={code}>[]()</code> → <code className={code}>&lt;url|text&gt;</code>).</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

const kbd =
  'rounded border border-slate-300 bg-slate-50 px-1 py-0.5 font-mono text-[11px] text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200';
const code =
  'rounded bg-slate-100 px-1 py-0.5 font-mono text-[12px] text-slate-700 dark:bg-slate-800 dark:text-slate-200';

function ShortcutCard({
  title,
  entries,
}: {
  title: string;
  entries: Array<[string, string]>;
}) {
  return (
    <section className="rounded border border-slate-200 p-3 dark:border-slate-700">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {title}
      </h3>
      <table className="w-full text-xs">
        <tbody>
          {entries.map(([k, v], i) => (
            <tr
              key={i}
              className={i > 0 ? 'border-t border-slate-100 dark:border-slate-800' : ''}
            >
              <td className="whitespace-nowrap py-1.5 pr-2 align-top">
                <kbd className={kbd}>{k}</kbd>
              </td>
              <td className="py-1.5 text-slate-700 dark:text-slate-300">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
