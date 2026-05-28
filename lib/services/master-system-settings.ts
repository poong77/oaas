/**
 * 마스터 — system_settings (Phase 9). 어드민 only.
 * key-value. value는 jsonb (문자열/숫자/객체).
 */

import 'server-only';
import { and, asc, eq } from 'drizzle-orm';

import { db } from '@/db';
import {
  systemSettings,
  type NewSystemSetting,
  type SystemSetting,
} from '@/db/schema';

/** 시드 + UI 화이트리스트. 새 키 추가 시 여기에 등록. */
export const KNOWN_SETTING_KEYS = [
  'max_upload_mb',
  'rate_limit_login_per_min',
  'slack_channels',
  'business_hours',
  'contact_phone',
] as const;
export type KnownSettingKey = (typeof KNOWN_SETTING_KEYS)[number];

export async function listSystemSettings(
  includeInactive = false,
): Promise<SystemSetting[]> {
  if (!db) return [];
  try {
    const conditions = [];
    if (!includeInactive) conditions.push(eq(systemSettings.isActive, true));
    const where = conditions.length === 0 ? undefined : and(...conditions);
    return await db
      .select()
      .from(systemSettings)
      .where(where)
      .orderBy(asc(systemSettings.key));
  } catch (err) {
    console.error('[master-system-settings.listSystemSettings] 실패:', err);
    return [];
  }
}

export async function getSystemSetting(
  key: string,
): Promise<SystemSetting | null> {
  if (!db) return null;
  try {
    const rows = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, key))
      .limit(1);
    return rows[0] ?? null;
  } catch (err) {
    console.error('[master-system-settings.getSystemSetting] 실패:', err);
    return null;
  }
}

export type SystemSettingWriteInput = {
  key: string;
  value: unknown;
  description?: string | null;
};

export async function upsertSystemSetting(
  input: SystemSettingWriteInput,
  updatedBy: string | null,
): Promise<{ ok: boolean; id?: string; message?: string }> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  try {
    const row: NewSystemSetting = {
      key: input.key,
      value: input.value,
      description: input.description ?? null,
      updatedBy: updatedBy ?? null,
    };
    const [created] = await db
      .insert(systemSettings)
      .values(row)
      .onConflictDoUpdate({
        target: systemSettings.key,
        set: {
          value: row.value,
          description: row.description,
          updatedBy: row.updatedBy,
          isActive: true,
        },
      })
      .returning({ id: systemSettings.id });
    return { ok: true, id: created?.id };
  } catch (err) {
    console.error('[master-system-settings.upsertSystemSetting] 실패:', err);
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'INTERNAL_ERROR',
    };
  }
}

export async function setSystemSettingActive(
  id: string,
  isActive: boolean,
): Promise<{ ok: boolean; message?: string }> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  try {
    await db
      .update(systemSettings)
      .set({ isActive })
      .where(eq(systemSettings.id, id));
    return { ok: true };
  } catch (err) {
    console.error(
      '[master-system-settings.setSystemSettingActive] 실패:',
      err,
    );
    return { ok: false, message: 'INTERNAL_ERROR' };
  }
}
