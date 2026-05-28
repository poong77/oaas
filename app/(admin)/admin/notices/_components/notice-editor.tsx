'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition, type ReactNode } from 'react';
import { Eye, Save, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { MarkdownView } from '@/components/articles/markdown-view';
import { useConfirmDialog } from '@/components/dialogs/confirm-dialog';
import type { ProductCategoryView } from '@/lib/services/categories';
import type { NoticeKind } from '@/db/schema';
import { NOTICE_KIND_META } from '@/lib/services/notices-meta';
import {
  createNoticeAction,
  updateNoticeAction,
} from '@/app/actions/notice-actions';

type EditorMode = 'create' | 'edit';

type InitialValues = {
  id: string;
  kind: NoticeKind;
  productCode: string | null;
  title: string;
  bodyMarkdown: string;
  pinned: boolean;
  banner: boolean;
  /** ISO string for datetime-local */
  bannerUntilIso: string | null;
  isPublished: boolean;
};

const KIND_OPTIONS: NoticeKind[] = ['notice', 'release', 'incident'];

export function NoticeEditor({
  mode,
  categories,
  initial,
}: {
  mode: EditorMode;
  categories: ProductCategoryView[];
  initial?: InitialValues;
}) {
  const router = useRouter();
  const confirm = useConfirmDialog();
  const [pending, startTransition] = useTransition();

  const [kind, setKind] = useState<NoticeKind>(initial?.kind ?? 'notice');
  const [productCode, setProductCode] = useState<string>(
    initial?.productCode ?? '',
  );
  const [title, setTitle] = useState(initial?.title ?? '');
  const [body, setBody] = useState(initial?.bodyMarkdown ?? '');
  const [pinned, setPinned] = useState(initial?.pinned ?? false);
  const [banner, setBanner] = useState(initial?.banner ?? false);
  const [bannerUntil, setBannerUntil] = useState<string>(
    initial?.bannerUntilIso ?? '',
  );

  const [activeTab, setActiveTab] = useState<'edit' | 'preview' | 'split'>(
    'split',
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function submit(publish: boolean) {
    setFieldErrors({});

    // banner_until이 과거이면 경고
    if (banner && bannerUntil) {
      const until = new Date(bannerUntil);
      if (!isNaN(until.getTime()) && until.getTime() < Date.now()) {
        const proceed = await confirm({
          title: '배너 노출 종료 시각이 이미 과거입니다',
          description:
            '저장해도 배너로 노출되지 않습니다. 그래도 진행하시겠습니까?',
          confirmText: '진행',
          tone: 'danger',
        });
        if (!proceed) return;
      }
    }

    // 발행 전 확인
    if (publish) {
      const ok = await confirm({
        title: '공지를 발행하시겠습니까?',
        description:
          '발행 즉시 호텔리어에게 노출됩니다. 추후 편집 시에는 즉시 반영됩니다.',
        confirmText: '발행',
      });
      if (!ok) return;
    }

    const formData = new FormData();
    formData.set('kind', kind);
    formData.set('productCode', productCode); // empty string → 전체
    formData.set('title', title.trim());
    formData.set('bodyMarkdown', body);
    formData.set('pinned', pinned ? 'on' : '');
    formData.set('banner', banner ? 'on' : '');
    formData.set('bannerUntil', banner ? bannerUntil : '');
    formData.set('publishMode', publish ? 'publish' : 'draft');

    startTransition(async () => {
      const result =
        mode === 'create'
          ? await createNoticeAction(undefined, formData)
          : await updateNoticeAction(initial!.id, undefined, formData);

      if (result.ok && result.id) {
        toast.success(
          mode === 'create'
            ? publish
              ? '발행되었습니다'
              : 'Draft로 저장되었습니다'
            : '저장되었습니다',
        );
        if (mode === 'create') {
          router.push(`/admin/notices/${result.id}`);
        } else {
          router.refresh();
        }
      } else {
        if (result.fieldErrors) setFieldErrors(result.fieldErrors);
        toast.error(result.message ?? '저장 실패');
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {/* 메타 정보 폼 */}
      <Card>
        <CardContent className="grid gap-4 p-5 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="kind">종류 *</Label>
            <Select
              id="kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as NoticeKind)}
            >
              {KIND_OPTIONS.map((k) => (
                <option key={k} value={k}>
                  {NOTICE_KIND_META[k].label} — {NOTICE_KIND_META[k].description}
                </option>
              ))}
            </Select>
            {fieldErrors.kind && <FieldError msg={fieldErrors.kind} />}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="productCode">제품</Label>
            <Select
              id="productCode"
              value={productCode}
              onChange={(e) => setProductCode(e.target.value)}
            >
              <option value="">전체 공지 (제품 무관)</option>
              {categories.map((c) => (
                <option key={c.id} value={c.code}>
                  {c.label}
                </option>
              ))}
            </Select>
            <span className="text-xs text-slate-500">
              특정 제품 관련 공지면 선택. 전체 공지면 비워두세요.
            </span>
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="title">제목 *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              placeholder="예: v1.1.0 릴리즈 노트 — 이슈 클레임 UX 개선"
            />
            {fieldErrors.title && <FieldError msg={fieldErrors.title} />}
          </div>

          {/* pinned + banner 옵션 */}
          <div className="flex flex-col gap-2 rounded-md border border-slate-200 p-3 dark:border-slate-700 sm:col-span-2">
            <Label className="text-sm font-semibold">노출 옵션</Label>
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={pinned}
                onChange={(e) => setPinned(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              <span>
                <strong>핀 고정</strong> — 공지 목록 상단에 항상 고정 노출
              </span>
            </label>
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={banner}
                onChange={(e) => setBanner(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              <span>
                <strong>홈 배너 노출</strong> — 모든 페이지 상단에 띠 노출
                (긴급용)
              </span>
            </label>
            {banner && (
              <div className="ml-6 flex flex-col gap-1.5">
                <Label
                  htmlFor="bannerUntil"
                  className="text-xs text-slate-600 dark:text-slate-400"
                >
                  배너 자동 해제 시각 (선택 — 비워두면 수동 해제 시까지)
                </Label>
                <Input
                  id="bannerUntil"
                  type="datetime-local"
                  value={bannerUntil}
                  onChange={(e) => setBannerUntil(e.target.value)}
                  className="max-w-xs"
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 본문 split view */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-5">
          <div className="flex items-center justify-between">
            <Label>본문 (Markdown) *</Label>
            <div className="flex items-center gap-1 rounded-md border border-slate-200 p-0.5 text-xs dark:border-slate-700">
              <TabButton
                active={activeTab === 'edit'}
                onClick={() => setActiveTab('edit')}
              >
                작성
              </TabButton>
              <TabButton
                active={activeTab === 'split'}
                onClick={() => setActiveTab('split')}
              >
                양쪽
              </TabButton>
              <TabButton
                active={activeTab === 'preview'}
                onClick={() => setActiveTab('preview')}
              >
                <Eye className="h-3 w-3" />
                미리보기
              </TabButton>
            </div>
          </div>

          <div
            className={
              activeTab === 'split' ? 'grid gap-3 lg:grid-cols-2' : 'grid gap-3'
            }
          >
            {(activeTab === 'edit' || activeTab === 'split') && (
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={20}
                placeholder={`## 변경 사항\n\n- 항목 1\n- 항목 2\n\n## 영향 범위\n\n...`}
                className="font-mono text-sm"
              />
            )}
            {(activeTab === 'preview' || activeTab === 'split') && (
              <div className="min-h-[20rem] overflow-auto rounded-md border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950">
                {body.trim() ? (
                  <MarkdownView source={body} />
                ) : (
                  <p className="text-sm text-slate-400">
                    본문을 입력하면 이곳에 미리보기가 표시됩니다.
                  </p>
                )}
              </div>
            )}
          </div>
          {fieldErrors.bodyMarkdown && (
            <FieldError msg={fieldErrors.bodyMarkdown} />
          )}
        </CardContent>
      </Card>

      {/* 액션 */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => submit(false)}
          disabled={pending}
        >
          <Save className="h-4 w-4" />
          Draft 저장
        </Button>
        <Button type="button" onClick={() => submit(true)} disabled={pending}>
          <Upload className="h-4 w-4" />
          {mode === 'edit' && initial?.isPublished
            ? '저장 + 재발행'
            : '발행하기'}
        </Button>
        {pending && <span className="text-xs text-slate-500">저장 중...</span>}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded px-2 py-1 font-medium transition-colors ${
        active
          ? 'bg-brand-600 text-white'
          : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
      }`}
    >
      {children}
    </button>
  );
}

function FieldError({ msg }: { msg: string }) {
  return <span className="text-xs text-rose-600">{msg}</span>;
}
