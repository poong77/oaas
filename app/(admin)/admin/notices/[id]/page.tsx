/**
 * /admin/notices/[id] — 공지 편집 (NT-01).
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { requireRole } from '@/lib/permissions';
import { getNoticeById } from '@/lib/services/notices';
import { getProductCategories } from '@/lib/services/categories';
import { kstDateTimeLocal } from '@/lib/date/kst';
import { PageHeader } from '@/components/ui/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { NoticeEditor } from '../_components/notice-editor';

export const dynamic = 'force-dynamic';

type RouteParams = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: RouteParams }) {
  const { id } = await params;
  const notice = await getNoticeById(id, {
    includeUnpublished: true,
    includeInactive: true,
  });
  return {
    title: notice
      ? `${notice.title} 편집 — OA 통합 AS 어드민`
      : '공지 편집 — OA 통합 AS 어드민',
  };
}

export default async function EditNoticePage({
  params,
}: {
  params: RouteParams;
}) {
  await requireRole(['manager', 'admin']);
  const { id } = await params;
  const [notice, categories] = await Promise.all([
    getNoticeById(id, { includeUnpublished: true, includeInactive: true }),
    getProductCategories(),
  ]);
  if (!notice) notFound();

  // datetime-local 형식(YYYY-MM-DDTHH:mm)으로 변환 — 항상 KST 벽시각으로 표시
  const bannerUntilIso = notice.bannerUntil
    ? kstDateTimeLocal(new Date(notice.bannerUntil))
    : null;
  const popupUntilIso = notice.popupUntil
    ? kstDateTimeLocal(new Date(notice.popupUntil))
    : null;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={
          <span className="inline-flex items-center gap-2">
            공지 편집
            {notice.publishedAt ? (
              <Badge tone="success">발행됨</Badge>
            ) : (
              <Badge tone="warn">Draft</Badge>
            )}
            {notice.banner && <Badge tone="danger">배너</Badge>}
            {notice.popupEnabled && <Badge tone="warn">팝업</Badge>}
            {!notice.isActive && <Badge tone="danger">비활성</Badge>}
          </span>
        }
        description={notice.title}
        breadcrumb={
          <Link
            href="/admin/notices"
            className="inline-flex items-center gap-1 hover:underline"
          >
            <ArrowLeft className="h-3 w-3" />
            공지 관리
          </Link>
        }
        actions={
          notice.publishedAt && notice.isActive ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/notices/${notice.id}`} target="_blank">
                <ExternalLink className="h-3.5 w-3.5" />
                공개 페이지 보기
              </Link>
            </Button>
          ) : null
        }
      />
      <NoticeEditor
        categories={categories}
        mode="edit"
        initial={{
          id: notice.id,
          kind: notice.kind,
          productCode: notice.productCode,
          title: notice.title,
          bodyMarkdown: notice.bodyMarkdown,
          pinned: notice.pinned,
          banner: notice.banner,
          bannerUntilIso,
          popupEnabled: notice.popupEnabled,
          popupImageUrl: notice.popupImageUrl,
          popupImageWidth: notice.popupImageWidth,
          popupImageHeight: notice.popupImageHeight,
          popupSize: notice.popupSize,
          popupUntilIso,
          isPublished: Boolean(notice.publishedAt),
        }}
      />
    </div>
  );
}
