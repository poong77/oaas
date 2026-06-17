/**
 * 메일 푸터(회사 정보) 저장/조회 (server-only).
 *
 * 발송 메일 본문 하단에 자동 첨부되는 푸터를 어드민이 편집한다.
 * 저장: system_settings 키 `mail_footer` (jsonb { markdown }).
 *   - 미저장 시 DEFAULT_MAIL_FOOTER_MD(첨부 이미지 내용) 사용.
 *   - markdown은 리치에디터 출력(텍스트·이미지 포함). 발송 시 markdownToHtml로 변환.
 */

import 'server-only';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { systemSettings } from '@/db/schema';
import { DEFAULT_MAIL_FOOTER_MD } from '@/lib/messaging/format';

export const MAIL_FOOTER_SETTING_KEY = 'mail_footer';

/** 저장된 푸터 마크다운(없으면 기본값). */
export async function getMailFooterMarkdown(): Promise<string> {
  if (!db) return DEFAULT_MAIL_FOOTER_MD;
  try {
    const rows = await db
      .select({ value: systemSettings.value })
      .from(systemSettings)
      .where(eq(systemSettings.key, MAIL_FOOTER_SETTING_KEY))
      .limit(1);
    const value = rows[0]?.value;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const md = (value as { markdown?: unknown }).markdown;
      if (typeof md === 'string' && md.trim().length > 0) return md;
    }
    return DEFAULT_MAIL_FOOTER_MD;
  } catch (err) {
    console.error('[mail-footer.getMailFooterMarkdown] 실패:', err);
    return DEFAULT_MAIL_FOOTER_MD;
  }
}

/** 푸터 마크다운 저장(upsert). */
export async function setMailFooterMarkdown(
  markdown: string,
  updatedBy: string | null,
): Promise<{ ok: boolean; message?: string }> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  try {
    const value = { markdown };
    await db
      .insert(systemSettings)
      .values({
        key: MAIL_FOOTER_SETTING_KEY,
        value,
        description: '발송 메일 본문 하단에 자동 첨부되는 푸터(마크다운)',
        updatedBy: updatedBy ?? null,
      })
      .onConflictDoUpdate({
        target: systemSettings.key,
        set: { value, updatedBy: updatedBy ?? null, isActive: true },
      });
    return { ok: true };
  } catch (err) {
    console.error('[mail-footer.setMailFooterMarkdown] 실패:', err);
    return { ok: false, message: err instanceof Error ? err.message : 'INTERNAL_ERROR' };
  }
}
