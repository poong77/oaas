/**
 * /admin/master/synonyms — 동의어 사전 원페이지 관리.
 *
 * 한 화면에서 대표어+동의어 입력 / AI 추천(숙박업계) / 검색 / 삭제까지 수행.
 * 어드민·매니저 only.
 */

import { requireRole } from '@/lib/permissions';
import { PageHeader } from '@/components/ui/page-header';
import { listTermGroupsWithSynonyms } from '@/lib/services/master-synonyms';
import { analyzeKeywordGaps } from '@/lib/services/keyword-gap';
import { SynonymsManager } from './_components/synonyms-manager';

export const dynamic = 'force-dynamic';
export const metadata = { title: '동의어 사전 — 마스터' };

export default async function SynonymsIndexPage() {
  await requireRole(['manager', 'admin']);
  const [groups, gapData] = await Promise.all([
    listTermGroupsWithSynonyms(),
    analyzeKeywordGaps({ limit: 30 }),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="동의어 사전"
        description="대표어 + 동의어로 통합 검색 결과를 확장합니다. AI 추천(숙박업계 기준)으로 빠르게 채우세요."
      />
      <SynonymsManager groups={groups} gapData={gapData} />
    </div>
  );
}
