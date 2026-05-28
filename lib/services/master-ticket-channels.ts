/**
 * 마스터 — ticket_channels (post-MVP).
 *
 * 어드민이 채널 추가/수정/숨김. tickets.channel은 code 문자열 참조 (FK 없음).
 * 시스템 채널('web', 'chatbot')은 비활성화/삭제 금지 (§9.1 시스템 보호).
 */

import 'server-only';
import { and, asc, eq } from 'drizzle-orm';
import { unstable_cache } from 'next/cache';

import { db } from '@/db';
import {
  ticketChannels,
  type NewTicketChannel,
  type TicketChannelRow,
} from '@/db/schema';
import { isSystemChannelCode } from '@/lib/ticket-channel-codes';

// 클라이언트 컴포넌트(channel-form 등)는 본 모듈 대신 `@/lib/ticket-channel-codes`를
// 직접 import해야 한다. isSystemChannelCode는 그곳의 동일 함수를 재노출만 한다.
export { isSystemChannelCode } from '@/lib/ticket-channel-codes';

// ─────────────────────────────────────────────────────────────────
// 조회
// ─────────────────────────────────────────────────────────────────

export async function listTicketChannels(
  options: { includeInactive?: boolean; selectableOnly?: boolean } = {},
): Promise<TicketChannelRow[]> {
  if (!db) return [];
  try {
    const conditions = [];
    if (!options.includeInactive)
      conditions.push(eq(ticketChannels.isActive, true));
    if (options.selectableOnly)
      conditions.push(eq(ticketChannels.selectableInAgentForm, true));
    const where = conditions.length === 0 ? undefined : and(...conditions);
    return await db
      .select()
      .from(ticketChannels)
      .where(where)
      .orderBy(asc(ticketChannels.sortOrder), asc(ticketChannels.label));
  } catch (err) {
    console.error('[master-ticket-channels.listTicketChannels] 실패:', err);
    return [];
  }
}

/** 매니저 대리 접수 폼 드롭다운용 (active + selectable). */
export const listAgentSelectableChannels = unstable_cache(
  () => listTicketChannels({ selectableOnly: true, includeInactive: false }),
  ['ticket-channels:agent-selectable'],
  { revalidate: 300, tags: ['ticket-channels'] },
);

/** 티켓 상세 라벨 표시용 (비활성 포함, 과거 데이터 라벨 보존). */
export const getAllTicketChannelsMap = unstable_cache(
  async () => {
    const rows = await listTicketChannels({ includeInactive: true });
    const map = new Map<string, TicketChannelRow>();
    for (const row of rows) map.set(row.code, row);
    return map;
  },
  ['ticket-channels:all-map'],
  { revalidate: 300, tags: ['ticket-channels'] },
);

export async function getTicketChannelById(
  id: string,
): Promise<TicketChannelRow | null> {
  if (!db) return null;
  try {
    const rows = await db
      .select()
      .from(ticketChannels)
      .where(eq(ticketChannels.id, id))
      .limit(1);
    return rows[0] ?? null;
  } catch (err) {
    console.error('[master-ticket-channels.getTicketChannelById] 실패:', err);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────
// Q-1: 검증 (createTicketByPhoneAction에서 사용)
// ─────────────────────────────────────────────────────────────────

/**
 * 채널 code가 마스터에 존재하고 selectableInAgentForm=true && is_active=true 인지 검증.
 * Plan Q-1: 미존재면 400 거부 (데이터 정합성 최우선).
 */
export async function isAgentChannelCodeValid(code: string): Promise<boolean> {
  if (!db) return false;
  try {
    const rows = await db
      .select({ code: ticketChannels.code })
      .from(ticketChannels)
      .where(
        and(
          eq(ticketChannels.code, code),
          eq(ticketChannels.selectableInAgentForm, true),
          eq(ticketChannels.isActive, true),
        ),
      )
      .limit(1);
    return rows.length > 0;
  } catch (err) {
    console.error('[master-ticket-channels.isAgentChannelCodeValid] 실패:', err);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────
// CRUD
// ─────────────────────────────────────────────────────────────────

export type TicketChannelWriteInput = {
  code: string;
  label: string;
  description?: string | null;
  icon?: string | null;
  selectableInAgentForm?: boolean;
  isAgentDefault?: boolean;
  sortOrder?: number;
};

export async function createTicketChannel(
  input: TicketChannelWriteInput,
): Promise<{ ok: boolean; id?: string; message?: string }> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  try {
    // isAgentDefault=true면 기존 default 토글
    if (input.isAgentDefault) {
      await db
        .update(ticketChannels)
        .set({ isAgentDefault: false, updatedAt: new Date() })
        .where(eq(ticketChannels.isAgentDefault, true));
    }
    const row: NewTicketChannel = {
      code: input.code,
      label: input.label,
      description: input.description ?? null,
      icon: input.icon ?? null,
      selectableInAgentForm: input.selectableInAgentForm ?? true,
      isAgentDefault: input.isAgentDefault ?? false,
      sortOrder: input.sortOrder ?? 0,
    };
    const [created] = await db
      .insert(ticketChannels)
      .values(row)
      .returning({ id: ticketChannels.id });
    return { ok: true, id: created?.id };
  } catch (err: unknown) {
    if (isUniqueViolation(err)) {
      return { ok: false, message: 'DUPLICATE_CODE' };
    }
    console.error('[master-ticket-channels.createTicketChannel] 실패:', err);
    return { ok: false, message: 'INSERT_FAILED' };
  }
}

export async function updateTicketChannel(
  id: string,
  input: Partial<TicketChannelWriteInput>,
): Promise<{ ok: boolean; message?: string }> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  try {
    // 시스템 채널 보호: code 변경 금지
    if (input.code !== undefined) {
      const current = await getTicketChannelById(id);
      if (current && isSystemChannelCode(current.code) && input.code !== current.code) {
        return { ok: false, message: 'SYSTEM_CODE_LOCKED' };
      }
    }
    // isAgentDefault=true면 기존 default 토글
    if (input.isAgentDefault === true) {
      await db
        .update(ticketChannels)
        .set({ isAgentDefault: false, updatedAt: new Date() })
        .where(eq(ticketChannels.isAgentDefault, true));
    }
    await db
      .update(ticketChannels)
      .set({
        ...(input.code !== undefined && { code: input.code }),
        ...(input.label !== undefined && { label: input.label }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.icon !== undefined && { icon: input.icon }),
        ...(input.selectableInAgentForm !== undefined && {
          selectableInAgentForm: input.selectableInAgentForm,
        }),
        ...(input.isAgentDefault !== undefined && {
          isAgentDefault: input.isAgentDefault,
        }),
        ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
        updatedAt: new Date(),
      })
      .where(eq(ticketChannels.id, id));
    return { ok: true };
  } catch (err: unknown) {
    if (isUniqueViolation(err)) {
      return { ok: false, message: 'DUPLICATE_CODE' };
    }
    console.error('[master-ticket-channels.updateTicketChannel] 실패:', err);
    return { ok: false, message: 'UPDATE_FAILED' };
  }
}

/** Soft delete (CLAUDE.md DB 원칙). 시스템 채널 보호. */
export async function deactivateTicketChannel(
  id: string,
): Promise<{ ok: boolean; message?: string }> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  const current = await getTicketChannelById(id);
  if (!current) return { ok: false, message: 'NOT_FOUND' };
  if (isSystemChannelCode(current.code)) {
    return { ok: false, message: 'SYSTEM_CHANNEL_LOCKED' };
  }
  await db
    .update(ticketChannels)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(ticketChannels.id, id));
  return { ok: true };
}

export async function activateTicketChannel(
  id: string,
): Promise<{ ok: boolean; message?: string }> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  await db
    .update(ticketChannels)
    .set({ isActive: true, updatedAt: new Date() })
    .where(eq(ticketChannels.id, id));
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────
// 헬퍼
// ─────────────────────────────────────────────────────────────────

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: unknown }).code === '23505'
  );
}
