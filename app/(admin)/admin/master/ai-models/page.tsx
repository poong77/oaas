/**
 * /admin/master/ai-models — AI 답변 초안 모델 마스터 (ai-reply-assist).
 *
 * 어드민 전용. 모델 목록/기본값/ON·OFF/정렬/라벨·단가 편집.
 * 모델을 코드에 하드코딩하지 않고 여기서 관리 — 신모델·가격변동 시 무중단 대응.
 */

import Link from 'next/link';
import { ArrowLeft, Bot } from 'lucide-react';

import { requireRole } from '@/lib/permissions';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { listAllModels } from '@/lib/services/ai-models';
import { AiModelsManager, type ManagerModel } from './_components/ai-models-manager';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'AI 모델 — 마스터DB' };

export default async function MasterAiModelsPage() {
  await requireRole(['admin']);
  const rows = await listAllModels();
  const models: ManagerModel[] = rows.map((m) => ({
    id: m.id,
    provider: m.provider,
    code: m.code,
    label: m.label,
    description: m.description,
    tier: m.tier,
    isDefault: m.isDefault,
    isActive: m.isActive,
    sortOrder: m.sortOrder,
  }));

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="AI 모델"
        description="티켓 답변 초안 생성에 사용할 모델을 관리합니다. 활성 모델만 매니저 화면 모달에 노출되며, 기본 모델이 초기 선택됩니다."
        breadcrumb={
          <Link
            href="/admin/master"
            className="inline-flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <ArrowLeft className="h-3 w-3" /> 마스터DB
          </Link>
        }
      />

      <Card>
        <CardContent className="p-5">
          <AiModelsManager initialModels={models} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-start gap-3 p-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300">
            <Bot className="h-4 w-4" />
          </span>
          <div className="flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-300">
            <strong className="text-slate-900 dark:text-slate-100">
              라벨 표기 규칙
            </strong>
            <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              <span className="font-medium">표시명</span>은 모달·리스트에 그대로
              노출됩니다(예: <span className="font-mono">Claude Haiku 4.5 · 약 7원/건</span>).{' '}
              <span className="font-medium">설명</span>에는 1M 토큰 단가·특성을
              적습니다(예: <span className="font-mono">입$1·출$5/1M · 한국어 CS 균형</span>).
              가격 변동 시 여기서 직접 수정하세요. <span className="font-mono">code</span>는
              실제 API 모델 ID이므로 신중히 변경하세요.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
