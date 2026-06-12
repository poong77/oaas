/**
 * /admin/master/knowledge-export — CB-05 지식팩 내보내기.
 *
 * 발행 아티클 + 활성 FAQ + 동의어를 GPT-4o mini 최적 포맷(Markdown / JSONL)으로
 * 가공해 다운로드. 매니저+어드민.
 */

import { Bot, BookA, FileText, HelpCircle, Sparkles } from 'lucide-react';

import { requireRole } from '@/lib/permissions';
import { getProductCategories } from '@/lib/services/categories';
import {
  buildKnowledgePack,
  toMarkdown,
} from '@/lib/services/knowledge-export';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { ExportControls } from './_components/export-controls';

export const dynamic = 'force-dynamic';
export const metadata = { title: '지식팩 내보내기 — OA서포트 어드민' };

type SearchParams = Promise<{ product?: string }>;

const PREVIEW_CHAR_LIMIT = 6000;

export default async function KnowledgeExportPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireRole(['manager', 'admin']);
  const sp = await searchParams;
  const productCode = sp.product?.trim() || undefined;

  const [products, pack] = await Promise.all([
    getProductCategories(),
    buildKnowledgePack({ productCode }),
  ]);

  const markdown = toMarkdown(pack);
  const preview =
    markdown.length > PREVIEW_CHAR_LIMIT
      ? markdown.slice(0, PREVIEW_CHAR_LIMIT) +
        '\n\n… (이하 생략 — 다운로드로 전체 확인)'
      : markdown;

  const selected = productCode ?? 'all';

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="지식팩 내보내기"
        description="발행 아티클·FAQ·동의어를 챗봇(GPT-4o mini)이 인식하기 쉬운 포맷으로 가공해 내려받습니다. 본문의 인라인 HTML을 정리하고, 동의어를 용어 사전으로 인라인하며, AI 사용 지침을 함께 담습니다."
      />

      {/* 컨트롤 + 통계 */}
      <Card>
        <CardContent className="flex flex-col gap-5 p-5">
          <ExportControls products={products} selected={selected} />

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              icon={<FileText className="h-4 w-4" />}
              label="발행 아티클"
              value={pack.stats.articleCount}
            />
            <StatCard
              icon={<HelpCircle className="h-4 w-4" />}
              label="활성 FAQ"
              value={pack.stats.faqCount}
            />
            <StatCard
              icon={<BookA className="h-4 w-4" />}
              label="동의어 그룹"
              value={pack.stats.synonymGroupCount}
            />
            <StatCard
              icon={<Sparkles className="h-4 w-4" />}
              label="이형어"
              value={pack.stats.synonymTermCount}
            />
          </div>
        </CardContent>
      </Card>

      {/* 포맷 안내 */}
      <Card>
        <CardContent className="grid gap-3 p-5 sm:grid-cols-2">
          <FormatNote
            title="knowledge.md (Markdown)"
            desc="사람이 검수하기 좋은 단일 지식 문서. AI 사용 지침 → 용어 사전 → 아티클 → FAQ 순. Custom GPT 지식 파일이나 시스템 프롬프트 첨부에 사용."
          />
          <FormatNote
            title="knowledge.jsonl (JSONL)"
            desc="1행 1레코드(synonym / article / faq). OpenAI Assistants file_search·임베딩 재색인 등 프로그램적 활용에 최적. RAG 파이프라인에 그대로 투입 가능."
          />
        </CardContent>
      </Card>

      {/* 미리보기 */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-5">
          <div className="flex items-center gap-2">
            <span className="bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-300 flex h-7 w-7 items-center justify-center rounded-md">
              <FileText className="h-4 w-4" />
            </span>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Markdown 미리보기
            </h2>
            <span className="text-xs text-slate-400">
              (앞부분 {PREVIEW_CHAR_LIMIT.toLocaleString()}자)
            </span>
          </div>
          <pre className="max-h-[28rem] overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
            {preview}
          </pre>
        </CardContent>
      </Card>

      {/* AI 활용 안내 */}
      <Card>
        <CardContent className="flex items-start gap-3 p-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300">
            <Bot className="h-4 w-4" />
          </span>
          <div className="flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-300">
            <strong className="text-slate-900 dark:text-slate-100">
              챗봇 연동 팁
            </strong>
            <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              이 지식팩은 <span className="font-mono">status=published</span>{' '}
              발행본만 포함합니다. 콘텐츠를 수정·발행한 뒤 다시 내려받아 챗봇
              지식을 갱신하세요. 실시간 RAG 검색은 별도 임베딩 파이프라인을
              사용하므로, 이 파일은 Custom GPT·Assistants 등 "스냅샷을 직접
              먹이는" 경로에 적합합니다. PDF는 AI 인식률·토큰 효율이 낮아
              제외했습니다.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
        {icon}
        {label}
      </span>
      <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">
        {value.toLocaleString()}
      </span>
    </div>
  );
}

function FormatNote({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-slate-200 p-4 dark:border-slate-800">
      <span className="font-mono text-xs font-semibold text-slate-900 dark:text-slate-100">
        {title}
      </span>
      <span className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
        {desc}
      </span>
    </div>
  );
}
