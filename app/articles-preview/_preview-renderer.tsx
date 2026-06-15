'use client';

/**
 * 미리보기 클라이언트 렌더러.
 *
 * - useSearchParams 로 ?key 읽고 localStorage 에서 미리보기 데이터 조회
 * - 데이터가 없거나 만료(10분 TTL) → 안내 화면
 * - 있으면 /help/[product]/[content_type]/[slug] 와 동일 레이아웃으로 렌더
 *
 * 미표시:
 *   - 관련 문서 카드 (저장 안 됨 + DB 의존)
 *   - 도움됨 위젯·공유 바·view tracker
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, CalendarDays, Eye, FileQuestion, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MarkdownView } from '@/components/articles/markdown-view';
import { ArticleToc } from '@/components/articles/article-toc';
import { extractToc } from '@/lib/articles/toc-extractor';
import { CONTENT_TYPE_LABEL } from '@/lib/articles/zod-schemas';
import { CONTENT_TYPE_META } from '@/lib/articles/content-type-meta';
import {
  loadPreview,
  clearPreview,
  type PreviewArticleData,
} from '@/lib/articles/preview-store';

export function PreviewRenderer() {
  const searchParams = useSearchParams();
  const key = searchParams.get('key');
  const [data, setData] = useState<PreviewArticleData | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing'>(
    'loading',
  );

  useEffect(() => {
    if (!key) {
      setStatus('missing');
      return;
    }
    const loaded = loadPreview(key);
    if (!loaded) {
      setStatus('missing');
      return;
    }
    setData(loaded);
    setStatus('ready');
  }, [key]);

  // 창 닫힐 때 localStorage 정리 (best-effort)
  useEffect(() => {
    if (!key) return;
    const handler = () => clearPreview(key);
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [key]);

  const toc = useMemo(
    () => (data ? extractToc(data.bodyMarkdown) : []),
    [data],
  );

  if (status === 'loading') {
    return (
      <div className="mx-auto flex w-full max-w-[1200px] items-center justify-center px-4 py-20 text-sm text-slate-500">
        미리보기 데이터를 불러오는 중...
      </div>
    );
  }

  if (status === 'missing' || !data) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 px-4 py-20 text-center">
        <FileQuestion className="h-12 w-12 text-slate-300" />
        <h1 className="text-lg font-semibold">미리보기 데이터를 찾을 수 없어요</h1>
        <p className="text-sm text-slate-500">
          미리보기는 10분간만 유효합니다. 편집기로 돌아가서 다시 시도해주세요.
          <br />
          (시크릿 모드·다른 브라우저·다른 기기에서 열면 데이터가 보이지 않아요)
        </p>
        <Button asChild variant="outline">
          <Link href="/admin/articles">
            <ArrowLeft className="h-4 w-4" />
            아티클 목록으로
          </Link>
        </Button>
      </div>
    );
  }

  const summaryText = data.summary;

  return (
    <>
      <PreviewBanner isPublishedSource={data.isPublishedSource} />

      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <div className="flex flex-col gap-3">
          <span className="inline-flex items-center gap-1 text-xs text-slate-500">
            <ArrowLeft className="h-3 w-3" />
            {data.productLabel} 가이드 (미리보기)
          </span>

          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="brand" className="uppercase">
              {data.productLabel}
            </Badge>
            <Badge tone={CONTENT_TYPE_META[data.contentType].tone}>
              {CONTENT_TYPE_LABEL[data.contentType]}
            </Badge>
            {data.categoryPath.map((seg, i) => (
              <Badge key={`${seg}-${i}`} tone="slate">
                {seg}
              </Badge>
            ))}
            <Badge tone="warn">DRAFT (미리보기)</Badge>
          </div>

          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {data.title}
          </h1>

          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3 w-3" />
              미발행
            </span>
            <span className="inline-flex items-center gap-1">
              <Eye className="h-3 w-3" />
              조회 0
            </span>
            {data.keywords.length > 0 && (
              <span className="flex flex-wrap items-center gap-1">
                {data.keywords.slice(0, 6).map((k) => (
                  <Badge key={k} tone="slate" className="text-[10px]">
                    #{k}
                  </Badge>
                ))}
              </span>
            )}
          </div>
        </div>

        <ArticleToc toc={toc} variant="mobile" />

        <div className="grid gap-6 lg:grid-cols-[1fr_240px]">
          <article className="flex flex-col gap-5">
            {summaryText && (
              <Card className="border-brand-200 bg-brand-50/60 dark:border-brand-900 dark:bg-brand-950/40">
                <CardContent className="flex flex-col gap-1 p-4 sm:p-5">
                  <span className="text-xs font-bold uppercase tracking-wide text-brand-700 dark:text-brand-300">
                    30초 요약
                  </span>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100 sm:text-base">
                    {summaryText}
                  </p>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardContent className="p-5 sm:p-7">
                <MarkdownView source={data.bodyMarkdown} />
              </CardContent>
            </Card>

            <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-400">
              ⓘ 미리보기에서는 <strong>관련 문서 카드</strong>·<strong>도움됨 위젯</strong>·
              <strong>공유 버튼</strong>은 표시되지 않아요. 발행 후 실제 페이지에서
              확인할 수 있습니다.
            </div>
          </article>

          <ArticleToc toc={toc} variant="sidebar" />
        </div>
      </div>
    </>
  );
}

function PreviewBanner({
  isPublishedSource,
}: {
  isPublishedSource: boolean;
}) {
  const [closed, setClosed] = useState(false);
  if (closed) return null;
  return (
    <div className="sticky top-0 z-40 border-b border-amber-300 bg-amber-100 px-4 py-2 text-xs text-amber-900 shadow-sm dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-200">
      <div className="mx-auto flex w-full max-w-[1200px] items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Eye className="h-3.5 w-3.5 shrink-0" />
          <span>
            <strong>DRAFT 미리보기</strong> — 저장되지 않은 임시 데이터입니다.
            {isPublishedSource &&
              ' 이 글의 발행본은 별개로 유지돼요 (저장 전까지).'}
            {' '}이 탭을 닫으면 임시 데이터가 사라집니다.
          </span>
        </div>
        <button
          type="button"
          onClick={() => setClosed(true)}
          aria-label="배너 닫기"
          className="shrink-0 rounded p-1 hover:bg-amber-200 dark:hover:bg-amber-900/50"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
