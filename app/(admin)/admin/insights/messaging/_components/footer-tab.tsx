'use client';

/**
 * 푸터 탭 — 발송 메일 본문 하단에 자동 첨부되는 회사 정보 푸터 편집.
 * 리치에디터(텍스트·이미지)로 편집하고 저장하면, 이후 메일 발송 시 그대로 첨부된다.
 */

import { useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Save, RotateCcw, Eye } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RichEditor } from '@/components/editor/rich-editor';
import { useConfirmDialog } from '@/components/dialogs/confirm-dialog';
import { markdownToHtml } from '@/lib/editor/markdown-to-html';
import { DEFAULT_MAIL_FOOTER_MD } from '@/lib/messaging/format';
import { getMailFooterAction, saveMailFooterAction } from '@/app/actions/messaging-actions';

export function FooterTab() {
  const confirm = useConfirmDialog();
  const [body, setBody] = useState('');
  const [editorKey, setEditorKey] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [loading, startLoad] = useTransition();
  const [saving, startSave] = useTransition();

  useEffect(() => {
    startLoad(async () => {
      const res = await getMailFooterAction();
      if (res.ok && typeof res.markdown === 'string') {
        setBody(res.markdown);
        setEditorKey((k) => k + 1);
      } else if (!res.ok) {
        toast.error(res.message ?? '푸터 조회 실패');
      }
      setLoaded(true);
    });
  }, []);

  function save() {
    startSave(async () => {
      const res = await saveMailFooterAction({ markdown: body });
      if (!res.ok) {
        toast.error(res.message ?? '저장 실패');
        return;
      }
      toast.success('푸터를 저장했습니다. 이후 발송되는 메일에 반영됩니다.');
    });
  }

  async function resetDefault() {
    const ok = await confirm({
      title: '기본 푸터로 되돌리기',
      description: '회사 기본 푸터 내용으로 초기화합니다. 저장해야 실제 발송에 반영됩니다.',
      confirmText: '되돌리기',
    });
    if (!ok) return;
    setBody(DEFAULT_MAIL_FOOTER_MD);
    setEditorKey((k) => k + 1);
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm text-slate-500">
            메일 발송 시 본문 하단에 자동으로 붙는 푸터입니다. 텍스트·이미지·링크를 자유롭게 편집하세요.
          </span>
          <Button type="button" variant="outline" size="sm" onClick={resetDefault} disabled={loading || saving}>
            <RotateCcw className="h-4 w-4" />
            기본값
          </Button>
        </div>

        <div className="flex flex-col gap-2">
          <Label className="text-xs">푸터 내용</Label>
          {loaded ? (
            <RichEditor
              key={editorKey}
              mode="full"
              value={body}
              onChange={setBody}
              minHeight={200}
              placeholder="회사 정보·연락처 등 메일 하단 푸터를 작성하세요. 이미지도 삽입할 수 있습니다."
              disabled={saving}
            />
          ) : (
            <div className="h-[200px] animate-pulse rounded-md border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/40" />
          )}
        </div>

        {/* 발송 미리보기 — 실제 메일에 첨부되는 모습 */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Eye className="h-3.5 w-3.5" />
            발송 미리보기 (본문 하단에 이렇게 붙습니다)
          </div>
          <div className="rounded-md border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <div className="border-t border-slate-200 pt-3 text-[12px] leading-relaxed text-slate-500 dark:border-slate-700">
              <div
                className="prose prose-sm max-w-none dark:prose-invert [&_p]:my-1 [&_img]:my-1"
                dangerouslySetInnerHTML={{ __html: markdownToHtml(body) }}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="button" onClick={save} disabled={saving || loading}>
            <Save className="h-4 w-4" />
            {saving ? '저장 중…' : '푸터 저장'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
