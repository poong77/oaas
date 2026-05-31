'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Eye, ImageIcon, Save, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useConfirmDialog } from '@/components/dialogs/confirm-dialog';
import { RichEditor } from '@/components/editor/rich-editor';
import { ImageUploadDialog } from '@/components/editor/dialogs/image-upload-dialog';
import { PopupBannerModal } from '@/components/notices/popup-banner-modal';
import { deleteDraftAfterPublish } from '@/lib/editor/draft-client';
import type { ProductCategoryView } from '@/lib/services/categories';
import type { NoticeKind, NoticePopupSize } from '@/db/schema';
import {
  NOTICE_KIND_META,
  NOTICE_POPUP_SIZE_META,
} from '@/lib/services/notices-meta';
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
  popupEnabled: boolean;
  popupImageUrl: string | null;
  popupSize: NoticePopupSize;
  /** ISO string for datetime-local */
  popupUntilIso: string | null;
  isPublished: boolean;
};

const KIND_OPTIONS: NoticeKind[] = ['notice', 'release', 'incident'];
const POPUP_SIZE_OPTIONS: NoticePopupSize[] = ['small', 'medium', 'large'];

/** 'YYYY-MM-DDTHH:mm' (local) — N일 뒤 또는 빈 문자열 */
function daysFromNowInput(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

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

  // NT-04 홈 팝업 배너
  const [popupEnabled, setPopupEnabled] = useState(
    initial?.popupEnabled ?? false,
  );
  const [popupImageUrl, setPopupImageUrl] = useState<string | null>(
    initial?.popupImageUrl ?? null,
  );
  const [popupSize, setPopupSize] = useState<NoticePopupSize>(
    initial?.popupSize ?? 'medium',
  );
  const [popupUntil, setPopupUntil] = useState<string>(
    initial?.popupUntilIso ?? '',
  );
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

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

    // 팝업 켰는데 이미지가 없으면 노출 불가 — 경고
    if (popupEnabled && !popupImageUrl) {
      const proceed = await confirm({
        title: '팝업 배너 이미지가 없습니다',
        description:
          '이미지를 등록하지 않으면 홈 팝업으로 노출되지 않습니다. 그래도 진행하시겠습니까?',
        confirmText: '진행',
        tone: 'danger',
      });
      if (!proceed) return;
    }

    // 팝업 종료 시각이 이미 과거이면 경고
    if (popupEnabled && popupUntil) {
      const until = new Date(popupUntil);
      if (!isNaN(until.getTime()) && until.getTime() < Date.now()) {
        const proceed = await confirm({
          title: '팝업 노출 종료 시각이 이미 과거입니다',
          description:
            '저장해도 팝업으로 노출되지 않습니다. 그래도 진행하시겠습니까?',
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
    formData.set('popupEnabled', popupEnabled ? 'on' : '');
    formData.set('popupImageUrl', popupEnabled ? (popupImageUrl ?? '') : '');
    formData.set('popupSize', popupSize);
    formData.set('popupUntil', popupEnabled ? popupUntil : '');
    formData.set('publishMode', publish ? 'publish' : 'draft');

    startTransition(async () => {
      const result =
        mode === 'create'
          ? await createNoticeAction(undefined, formData)
          : await updateNoticeAction(initial!.id, undefined, formData);

      if (result.ok && result.id) {
        // 발행 성공 → 편집 모드 draft 자동 삭제 (신규는 nonce 모름, 자연 만료)
        await deleteDraftAfterPublish('notice', initial?.id ?? null);
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

            {/* NT-04 홈 팝업 배너 */}
            <div className="mt-1 border-t border-slate-200 pt-2 dark:border-slate-700">
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={popupEnabled}
                  onChange={(e) => setPopupEnabled(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                <span>
                  <strong>홈 팝업 배너</strong> — 홈 진입 시 이미지 팝업으로 노출
                </span>
              </label>
            </div>

            {popupEnabled && (
              <div className="ml-6 flex flex-col gap-4">
                {/* 이미지 */}
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-slate-600 dark:text-slate-400">
                    배너 이미지 *
                  </Label>
                  {popupImageUrl ? (
                    <div className="flex items-start gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={popupImageUrl}
                        alt="팝업 배너 미리보기"
                        className="h-24 w-auto rounded-md border border-slate-200 object-contain dark:border-slate-700"
                      />
                      <div className="flex flex-col gap-1.5">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setImageDialogOpen(true)}
                        >
                          <ImageIcon className="h-3.5 w-3.5" />
                          이미지 변경
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setPopupImageUrl(null)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          이미지 제거
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-fit"
                      onClick={() => setImageDialogOpen(true)}
                    >
                      <Upload className="h-3.5 w-3.5" />
                      이미지 업로드
                    </Button>
                  )}
                </div>

                {/* 크기 프리셋 */}
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-slate-600 dark:text-slate-400">
                    배너 크기
                  </Label>
                  <div className="inline-flex w-fit overflow-hidden rounded-md border border-slate-300 dark:border-slate-600">
                    {POPUP_SIZE_OPTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setPopupSize(s)}
                        className={cn(
                          'px-4 py-1.5 text-sm transition',
                          popupSize === s
                            ? 'bg-brand-600 text-white'
                            : 'bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700',
                        )}
                      >
                        {NOTICE_POPUP_SIZE_META[s].label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 종료일자 + 빠른 설정 */}
                <div className="flex flex-col gap-1.5">
                  <Label
                    htmlFor="popupUntil"
                    className="text-xs text-slate-600 dark:text-slate-400"
                  >
                    노출 종료일자 (비워두면 수동 해제 시까지)
                  </Label>
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      id="popupUntil"
                      type="datetime-local"
                      value={popupUntil}
                      onChange={(e) => setPopupUntil(e.target.value)}
                      className="max-w-xs"
                    />
                    <div className="flex gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setPopupUntil(daysFromNowInput(3))}
                      >
                        3일 노출
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setPopupUntil(daysFromNowInput(7))}
                      >
                        7일 노출
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setPopupUntil('')}
                      >
                        무기한
                      </Button>
                    </div>
                  </div>
                </div>

                {/* 미리보기 */}
                <div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!popupImageUrl}
                    onClick={() => setPreviewOpen(true)}
                  >
                    <Eye className="h-3.5 w-3.5" />
                    팝업 미리보기
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 본문 RichEditor */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-5">
          <Label>본문 *</Label>
          <RichEditor
            mode="full"
            value={body}
            onChange={setBody}
            minHeight={400}
            placeholder="공지 본문을 작성하세요. 헤딩·목록·코드 블록 등 사용 가능합니다."
            autoSave={{
              scope: 'notice',
              targetId: initial?.id ?? null,
            }}
          />
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

      {/* 팝업 배너 이미지 업로드 */}
      <ImageUploadDialog
        open={imageDialogOpen}
        onClose={() => setImageDialogOpen(false)}
        onUploaded={(url) => {
          setPopupImageUrl(url);
          setImageDialogOpen(false);
        }}
      />

      {/* 팝업 미리보기 */}
      {previewOpen && popupImageUrl && (
        <PopupBannerModal
          imageUrl={popupImageUrl}
          size={popupSize}
          title={title || '팝업 배너 미리보기'}
          preview
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </div>
  );
}

function FieldError({ msg }: { msg: string }) {
  return <span className="text-xs text-rose-600">{msg}</span>;
}
