'use client';

/**
 * EditorBody — RichEditor wrapper + 골격 주입 콜백.
 *
 * Phase 1: 단순 wrapper. 골격 주입은 shell에서 setBody로 처리.
 * Phase 3: A5 AI 보조 sticky bar 추가.
 * Phase 4: A6 재편집 패널 추가.
 *
 * @see docs/02-design/knowledge-base-overhaul/DESIGN.md §1-1
 */

import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RichEditor } from '@/components/editor/rich-editor';
import type { SaveStatus } from '@/components/editor/panels/save-indicator';

export interface EditorBodyProps {
  value: string;
  onChange: (v: string) => void;
  /** autoSave scope+targetId. null이면 자동저장 비활성화. */
  autoSave?: { scope: 'article'; targetId: string | null } | null;
  /** RichEditor 내부 자동저장 상태를 부모로 emit. */
  onAutosaveStatusChange?: (status: SaveStatus, lastSavedAt: number | null) => void;
  fieldError?: string;
}

export function EditorBody({
  value,
  onChange,
  autoSave,
  onAutosaveStatusChange,
  fieldError,
}: EditorBodyProps) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-5">
        <Label>본문 *</Label>
        <RichEditor
          mode="full"
          value={value}
          onChange={onChange}
          minHeight={480}
          placeholder="아티클 본문을 작성하세요. ## / ### 헤딩은 자동 TOC 생성."
          autoSave={autoSave ?? undefined}
          onAutosaveStatusChange={onAutosaveStatusChange}
        />
        {fieldError && (
          <span className="text-xs text-rose-600">{fieldError}</span>
        )}
      </CardContent>
    </Card>
  );
}
