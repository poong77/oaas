/**
 * 마스터 메뉴 접근 제어 (server-only).
 *
 * 마스터 하위 개별 메뉴별 "매니저 접근 허용 여부"를 관리한다.
 * 어드민은 항상 전체 접근. 매니저는 어드민이 끈(off) 메뉴에 진입 불가(notFound).
 *
 * 저장: system_settings 키 `master_menu_manager_access` (jsonb).
 *   값 형태: { "<menu-key>": false, ... }  — 매니저 OFF 오버라이드만 보관.
 *   누락 키는 기본 허용(true). hardAdminOnly 메뉴는 저장과 무관히 항상 매니저 차단.
 *
 * 가드 적용: 토글 대상 메뉴 폴더의 layout.tsx에서 requireMasterMenuAccess(key) 호출.
 */

import 'server-only';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';

import { db } from '@/db';
import { systemSettings } from '@/db/schema';
import {
  MASTER_MENU_ACCESS_SETTING_KEY,
  getMasterMenuMeta,
  resolveManagerAccess,
} from '@/lib/services/master-meta';
import { requireRole, type AuthorizedUser } from '@/lib/permissions';

/** 저장된 오버라이드 원본을 읽는다(없으면 빈 객체). */
async function readOverrides(): Promise<Record<string, unknown>> {
  if (!db) return {};
  try {
    const rows = await db
      .select({ value: systemSettings.value })
      .from(systemSettings)
      .where(eq(systemSettings.key, MASTER_MENU_ACCESS_SETTING_KEY))
      .limit(1);
    const value = rows[0]?.value;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return {};
  } catch (err) {
    console.error('[master-menu-access.readOverrides] 실패:', err);
    return {};
  }
}

/** 전 메뉴의 "매니저 접근 가능" 최종 맵. (hardAdminOnly는 항상 false) */
export async function getManagerAccessMap(): Promise<Record<string, boolean>> {
  const overrides = await readOverrides();
  return resolveManagerAccess(overrides);
}

/**
 * 특정 메뉴를 해당 역할이 접근 가능한지.
 * 어드민: 항상 true. 매니저: 접근 맵 기준. 그 외 역할: false.
 */
export async function canAccessMasterMenu(
  key: string,
  role: AuthorizedUser['role'],
): Promise<boolean> {
  if (role === 'admin') return true;
  if (role !== 'manager') return false;
  const map = await getManagerAccessMap();
  return map[key] === true;
}

/**
 * 매니저 접근 ON/OFF 저장 (어드민 액션에서 호출).
 * hardAdminOnly 메뉴는 변경 거부. read-modify-write 머지.
 */
export async function setManagerMenuAccess(
  key: string,
  allow: boolean,
  updatedBy: string | null,
): Promise<{ ok: boolean; message?: string }> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  const meta = getMasterMenuMeta(key);
  if (!meta) return { ok: false, message: 'UNKNOWN_MENU' };
  if (meta.hardAdminOnly) return { ok: false, message: 'ADMIN_ONLY_LOCKED' };

  try {
    const current = await readOverrides();
    const next: Record<string, unknown> = { ...current };
    if (allow) {
      // 기본이 허용이므로 오버라이드 제거 = 깔끔한 상태 유지
      delete next[key];
    } else {
      next[key] = false;
    }

    await db
      .insert(systemSettings)
      .values({
        key: MASTER_MENU_ACCESS_SETTING_KEY,
        value: next,
        description: '마스터 개별 메뉴의 매니저 접근 허용 오버라이드(false=차단)',
        updatedBy: updatedBy ?? null,
      })
      .onConflictDoUpdate({
        target: systemSettings.key,
        set: { value: next, updatedBy: updatedBy ?? null, isActive: true },
      });
    return { ok: true };
  } catch (err) {
    console.error('[master-menu-access.setManagerMenuAccess] 실패:', err);
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'INTERNAL_ERROR',
    };
  }
}

/**
 * 마스터 하위 메뉴 진입 가드.
 * 매니저+어드민 진입 허용 후, 매니저가 차단된 메뉴면 notFound().
 * 토글 대상 메뉴 폴더의 layout.tsx에서 호출한다.
 */
export async function requireMasterMenuAccess(
  key: string,
): Promise<AuthorizedUser> {
  const user = await requireRole(['manager', 'admin']);
  if (user.role === 'admin') return user;
  const map = await getManagerAccessMap();
  if (map[key] !== true) notFound();
  return user;
}
