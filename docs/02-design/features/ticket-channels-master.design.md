# ticket-channels-master — Design

> **Feature**: 유입 채널 마스터화 + 대리 접수 폼 채널 드롭다운
> **Phase**: Design (PDCA)
> **선행 문서**: [docs/01-plan/features/ticket-channels-master.plan.md](../../01-plan/features/ticket-channels-master.plan.md)
> **작성일**: 2026-05-28
> **상태**: APPROVED — Do 진입 가능

---

## 0. 개요

Plan에서 확정된 4개 결정사항(Q-1~Q-4)을 토대로 구현 명세를 확정한다.

| ID | 결정 | Design 반영 |
|:-:|:-|:-|
| Q-1 | 미존재 channel code 거부 (400) | §5.1 Zod `superRefine`로 마스터 IN 절 검증 |
| Q-2 | 1단계 마이그레이션 (text+drop 동시) | §3.4 마이그레이션 SQL 단일 트랜잭션 |
| Q-3 | 경로 `new-by-phone` 유지 | §6.2 페이지 제목/설명만 톤 다듬기 |
| Q-4 | 티켓 상세에만 아이콘+라벨 | §7.1 메타 영역에만, 리스트/칸반 미변경 |

---

## 1. 파일 변경 요약

### 1.1 신규 파일 (8개)

| 경로 | 역할 | 라인수 추정 |
|:-|:-|:-:|
| `db/schema/ticket-channels.ts` | Drizzle 스키마 | ~30 |
| `db/migrations/XXXX_ticket_channels.sql` | enum → text + 테이블 생성 + 시드 | ~50 |
| `lib/services/master-ticket-channels.ts` | CRUD + 마스터 cache 헬퍼 | ~180 |
| `lib/ticket-channel-label.ts` | 라벨 표시 유틸 (마스터 결과 → label/icon) | ~40 |
| `app/actions/master-ticket-channels-actions.ts` | Server Actions (create/update/toggle/delete) | ~150 |
| `app/(admin)/admin/master/ticket-channels/page.tsx` | 목록 페이지 | ~110 |
| `app/(admin)/admin/master/ticket-channels/new/page.tsx` | 신규 작성 페이지 | ~30 |
| `app/(admin)/admin/master/ticket-channels/[id]/page.tsx` | 상세/수정 페이지 | ~30 |
| `app/(admin)/admin/master/ticket-channels/_components/channel-form.tsx` | 공용 폼 컴포넌트 | ~200 |

### 1.2 수정 파일 (8개)

| 경로 | 변경 내용 |
|:-|:-|
| `db/schema/tickets.ts` | `ticketChannelEnum` 삭제, `channel: text('channel')`로 변경, `TicketChannel` 타입은 `string`로 정의 |
| `db/schema/index.ts` | `ticket-channels` export 추가 |
| `db/seed.ts` | 6개 시드 INSERT (web/phone/chatbot/kakao/email/walk_in) |
| `lib/services/tickets.ts` | `TicketChannel` import 제거, `string`로 처리 |
| `app/actions/ticket-actions.ts` | `createTicketByPhoneAction`에 channel 파라미터 + Zod `superRefine` 마스터 검증 추가 |
| `app/(admin)/admin/tickets/new-by-phone/page.tsx` | 마스터 channels 조회 → form props |
| `app/(admin)/admin/tickets/new-by-phone/_components/phone-ticket-form.tsx` | "유입 채널" Select 추가 + 페이지 제목/설명 톤 다듬기 |
| `app/tickets/[id]/page.tsx`, `app/(admin)/admin/tickets/[id]/page.tsx` | 라벨 헬퍼로 교체 (하드코드 분기 제거) |
| `docs/IMPLEMENTATION_PLAN.md` | L261 갱신 + 마스터 정의 섹션 추가 |
| `app/(admin)/admin/master/page.tsx` 또는 사이드바 | "유입 채널" 메뉴 카드 추가 |

---

## 2. DB 스키마 최종안

### 2.1 `ticket_channels` 테이블

```ts
// db/schema/ticket-channels.ts
import { boolean, integer, pgTable, text, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { commonColumns } from './_shared';

/**
 * 티켓 유입 채널 마스터 (Phase post-MVP).
 *
 * 어드민이 채널 추가/수정/숨김 가능. tickets.channel은 이 테이블의 code 문자열을
 * 참조하지만 FK는 걸지 않는다 (마스터 비활성화돼도 과거 티켓 라벨 보존).
 *
 * 시드: web, phone, chatbot, kakao, email, walk_in
 */
export const ticketChannels = pgTable(
  'ticket_channels',
  {
    ...commonColumns(),
    /** 'web' | 'phone' | 'chatbot' | 'kakao' | 'email' | 'walk_in' ... (snake_case) */
    code: text('code').notNull(),
    /** 사용자 표시 라벨: '웹', '전화', '챗봇', '카카오톡', '이메일', '방문' */
    label: text('label').notNull(),
    description: text('description'),
    /** lucide-react 컴포넌트 이름 ('Globe' | 'Phone' | 'MessageCircle' ...) */
    icon: text('icon'),
    /** 매니저 대리 접수 폼 드롭다운 노출 여부 */
    selectableInAgentForm: boolean('selectable_in_agent_form').notNull().default(true),
    /** 매니저 대리 접수 폼 기본 선택 (정책상 true는 1개. UI 가드, DB 제약 X) */
    isAgentDefault: boolean('is_agent_default').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (table) => [
    uniqueIndex('ticket_channels_code_uniq').on(table.code),
    index('ticket_channels_sort_idx').on(table.sortOrder),
  ],
);

export type TicketChannelRow = typeof ticketChannels.$inferSelect;
export type NewTicketChannel = typeof ticketChannels.$inferInsert;
```

**제약 설계 근거**:
- `code` UNIQUE: 마스터 IN 절 검증 + 마이그레이션 호환성 (`web/phone/chatbot` 보존)
- FK 없음: 마스터 비활성/삭제 시에도 과거 티켓 `channel` 컬럼 raw 값 보존
- `index(sortOrder)`: 어드민 목록 정렬 + 폼 드롭다운 정렬

### 2.2 `tickets.channel` 컬럼 변경

```ts
// db/schema/tickets.ts
// 삭제
export const ticketChannelEnum = pgEnum('ticket_channel_kind', [...]);
export type TicketChannel = (typeof ticketChannelEnum.enumValues)[number];

// 변경 후
export type TicketChannel = string;  // 마스터 code 참조 (검증은 service 레이어)

export const tickets = pgTable('tickets', {
  ...,
  channel: text('channel').notNull().default('web'),  // enum → text
  ...
});
```

### 2.3 자료 흐름 다이어그램

```
[매니저 대리 접수 폼]
  │
  ▼
GET /admin/tickets/new-by-phone (RSC)
  → listAgentSelectableChannels()  ← unstable_cache 5분
  → page → PhoneTicketForm props={channels}
  │
  ▼
[제출] → createTicketByPhoneAction(formData)
  → Zod parse(channel) + superRefine(마스터 IN 절)
  → channel='kakao' 검증 통과
  → createTicket({ channel: 'kakao' })
  → tickets 테이블에 'kakao' 저장
  │
  ▼
[티켓 상세 표시]
GET /admin/tickets/[id]
  → ticket.channel = 'kakao'
  → getChannelLabel('kakao')  ← unstable_cache 5분 (전체 마스터 1회 조회)
  → "카카오톡" + <MessageCircle> 아이콘 표시
```

---

## 3. 마이그레이션 SQL

### 3.1 단일 트랜잭션 (Q-2 결정)

```sql
-- migrations/XXXX_ticket_channels.sql
BEGIN;

-- 1. 새 마스터 테이블 생성
CREATE TABLE ticket_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  selectable_in_agent_form BOOLEAN NOT NULL DEFAULT TRUE,
  is_agent_default BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX ticket_channels_code_uniq ON ticket_channels(code);
CREATE INDEX ticket_channels_sort_idx ON ticket_channels(sort_order);

-- 2. 시드 데이터 INSERT (개발/운영 모두 필요)
INSERT INTO ticket_channels (code, label, icon, sort_order, selectable_in_agent_form, is_agent_default) VALUES
  ('web',      '웹',       'Globe',          10, FALSE, FALSE),
  ('phone',    '전화',     'Phone',          20, TRUE,  TRUE),
  ('chatbot',  '챗봇',     'Bot',            30, FALSE, FALSE),
  ('kakao',    '카카오톡', 'MessageCircle',  40, TRUE,  FALSE),
  ('email',    '이메일',   'Mail',           50, TRUE,  FALSE),
  ('walk_in',  '방문',     'Footprints',     60, TRUE,  FALSE);

-- 3. tickets.channel 컬럼 타입 변경 (enum → text)
--    기존 enum 값('web'/'phone'/'chatbot')은 USING enum::text로 무손실 보존
ALTER TABLE tickets ALTER COLUMN channel TYPE TEXT USING channel::TEXT;
ALTER TABLE tickets ALTER COLUMN channel SET DEFAULT 'web';

-- 4. enum 타입 제거 (사용처가 더 이상 없음)
DROP TYPE ticket_channel_kind;

COMMIT;
```

### 3.2 Drizzle Kit 명령

| 환경 | 명령 | 비고 |
|:-|:-|:-|
| Dev | `drizzle-kit push` | 자동 적용, 빠른 반복 |
| Prod | `drizzle-kit migrate` | 위 SQL 명시적 실행 |

### 3.3 롤백 방안

- **롤백 SQL** 별도 작성 (`migrations/XXXX_ticket_channels_down.sql`):
  ```sql
  BEGIN;
  CREATE TYPE ticket_channel_kind AS ENUM ('web', 'phone', 'chatbot');
  ALTER TABLE tickets ALTER COLUMN channel TYPE ticket_channel_kind
    USING channel::ticket_channel_kind;
  DROP TABLE ticket_channels;
  COMMIT;
  ```
  - **경고**: 'kakao'/'email'/'walk_in' 등 enum 외 값이 있으면 ALTER 실패 → 사전에 UPDATE 필요
- **git revert**: MVP 단계 권장 (Plan §8 Q-2 결정대로)

---

## 4. 서비스 레이어 명세

### 4.1 `lib/services/master-ticket-channels.ts`

```ts
import 'server-only';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { unstable_cache } from 'next/cache';
import { db } from '@/db';
import {
  ticketChannels,
  type NewTicketChannel,
  type TicketChannelRow,
} from '@/db/schema';

// ─────────────────────────────────────────────────────────────────
// 조회
// ─────────────────────────────────────────────────────────────────

export async function listTicketChannels(
  options: { includeInactive?: boolean; selectableOnly?: boolean } = {},
): Promise<TicketChannelRow[]> {
  if (!db) return [];
  try {
    const conditions = [];
    if (!options.includeInactive) conditions.push(eq(ticketChannels.isActive, true));
    if (options.selectableOnly) conditions.push(eq(ticketChannels.selectableInAgentForm, true));
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

/** 매니저 대리 접수 폼 드롭다운용. */
export const listAgentSelectableChannels = unstable_cache(
  () => listTicketChannels({ selectableOnly: true, includeInactive: false }),
  ['ticket-channels:agent-selectable'],
  { revalidate: 300, tags: ['ticket-channels'] }, // 5분
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
 * 채널 code가 마스터에 존재하고 selectableInAgentForm=true이며 is_active=true인지 검증.
 * 데이터 정합성 최우선 (Plan §8 Q-1).
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

export async function createTicketChannel(input: TicketChannelWriteInput): Promise<{
  ok: boolean; id?: string; message?: string;
}> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  try {
    const row: NewTicketChannel = {
      code: input.code,
      label: input.label,
      description: input.description ?? null,
      icon: input.icon ?? null,
      selectableInAgentForm: input.selectableInAgentForm ?? true,
      isAgentDefault: input.isAgentDefault ?? false,
      sortOrder: input.sortOrder ?? 0,
    };
    const [created] = await db.insert(ticketChannels).values(row).returning({ id: ticketChannels.id });
    return { ok: true, id: created?.id };
  } catch (err: any) {
    if (err?.code === '23505') return { ok: false, message: 'DUPLICATE_CODE' };
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
    await db.update(ticketChannels)
      .set({
        ...(input.code !== undefined && { code: input.code }),
        ...(input.label !== undefined && { label: input.label }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.icon !== undefined && { icon: input.icon }),
        ...(input.selectableInAgentForm !== undefined && { selectableInAgentForm: input.selectableInAgentForm }),
        ...(input.isAgentDefault !== undefined && { isAgentDefault: input.isAgentDefault }),
        ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
        updatedAt: new Date(),
      })
      .where(eq(ticketChannels.id, id));
    return { ok: true };
  } catch (err: any) {
    if (err?.code === '23505') return { ok: false, message: 'DUPLICATE_CODE' };
    console.error('[master-ticket-channels.updateTicketChannel] 실패:', err);
    return { ok: false, message: 'UPDATE_FAILED' };
  }
}

/** Soft delete (CLAUDE.md 5번 원칙). */
export async function deactivateTicketChannel(id: string): Promise<{ ok: boolean }> {
  if (!db) return { ok: false };
  await db.update(ticketChannels).set({ isActive: false, updatedAt: new Date() })
    .where(eq(ticketChannels.id, id));
  return { ok: true };
}

export async function activateTicketChannel(id: string): Promise<{ ok: boolean }> {
  if (!db) return { ok: false };
  await db.update(ticketChannels).set({ isActive: true, updatedAt: new Date() })
    .where(eq(ticketChannels.id, id));
  return { ok: true };
}
```

### 4.2 `lib/ticket-channel-label.ts` (라벨 헬퍼)

```ts
/**
 * 티켓 채널 라벨/아이콘 헬퍼.
 *
 * 마스터 조회 결과(Map)와 raw code를 받아 표시용 데이터 반환.
 * 마스터에 없으면 raw code 자체를 라벨로 fallback (UI 깨짐 방지).
 */
import type { TicketChannelRow } from '@/db/schema';

export type ChannelDisplay = {
  code: string;
  label: string;
  icon: string | null;
  isOrphan: boolean;  // 마스터에서 누락된 케이스
};

export function getChannelDisplay(
  code: string,
  map: Map<string, TicketChannelRow>,
): ChannelDisplay {
  const row = map.get(code);
  if (!row) {
    return { code, label: code, icon: null, isOrphan: true };
  }
  return { code, label: row.label, icon: row.icon, isOrphan: false };
}
```

---

## 5. Server Actions 명세

### 5.1 `app/actions/ticket-actions.ts` — `createTicketByPhoneAction` 변경

#### C1 처리 방침 (검증자 지적)

`parseTicketFormData()` (L559-597)는 공통 헬퍼이며 `createTicketAction`(셀프 접수, 'web' 고정)에도 쓰인다. 셀프 접수에는 channel formData가 오지 않으므로, 헬퍼를 확장하지 않고 **`createTicketByPhoneAction`에서만 별도로 `channel`을 추출**한다 (셀프 접수 영향 0).

```ts
// 추가 import
import { isAgentChannelCodeValid } from '@/lib/services/master-ticket-channels';

const PhoneTicketSchema = TicketCreateSchema.extend({
  hotelId: z.string().uuid().optional().nullable(),
  reporterId: z.string().uuid().optional().nullable(),
  /** Plan Q-1: 마스터 IN 절 검증은 액션에서 별도 수행 (DB 의존이라 superRefine 부적합) */
  channel: z.string().min(1).max(60),
});

export async function createTicketByPhoneAction(
  _prev: TicketCreateState | undefined,
  formData: FormData,
): Promise<TicketCreateState> {
  const user = await requireRole(['manager', 'admin']);

  const raw = {
    ...parseTicketFormData(formData),
    hotelId: (formData.get('hotelId')?.toString() ?? '').trim() || null,
    reporterId: (formData.get('reporterId')?.toString() ?? '').trim() || null,
    channel: (formData.get('channel')?.toString() ?? 'phone').trim(),
  };
  const parsed = PhoneTicketSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: '입력값을 확인해주세요',
      fieldErrors: shapeFieldErrors(parsed.error) };
  }

  // ─── Q-1: 마스터 IN 절 검증 ───
  const channelValid = await isAgentChannelCodeValid(parsed.data.channel);
  if (!channelValid) {
    return {
      ok: false,
      message: '유효하지 않은 유입 채널입니다.',
      fieldErrors: { channel: '드롭다운에서 다시 선택해주세요' },
    };
  }

  const input: CreateTicketInput = {
    ...,
    channel: parsed.data.channel,  // 'phone' 하드코드 제거 (Q-1 검증 통과한 값)
    ...
  };
  ...
}
```

**`createTicketAction` (셀프 접수)는 무변경**: `channel: 'web'` 하드코드 그대로 유지 (Plan R3).

### 5.2 `app/actions/master-ticket-channels-actions.ts` (신규)

#### W2 처리: 헬퍼 정의

- `shapeFieldErrors`는 `ticket-actions.ts:84-91`의 함수를 재사용한다 (모듈 내 private 함수이므로 본 파일에 동일 함수 복사 — Zod ZodError → Record<string,string> 변환, 10줄). 추후 `lib/zod-helpers.ts` 공용 모듈로 추출은 별도 리팩토링.
- `extractChannelFormData`는 인라인 객체로 처리 (별도 함수 불필요):

```ts
const raw = {
  code: (formData.get('code') ?? '').toString().trim(),
  label: (formData.get('label') ?? '').toString().trim(),
  description: (formData.get('description') ?? '').toString().trim() || null,
  icon: (formData.get('icon') ?? '').toString().trim() || null,
  selectableInAgentForm: formData.get('selectableInAgentForm') === 'on',
  isAgentDefault: formData.get('isAgentDefault') === 'on',
  sortOrder: (formData.get('sortOrder') ?? '0').toString().trim(),
};
```

#### 전체 코드

```ts
'use server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireRole } from '@/lib/permissions';
import { logActivity } from '@/lib/audit';
import {
  createTicketChannel, updateTicketChannel,
  activateTicketChannel, deactivateTicketChannel,
} from '@/lib/services/master-ticket-channels';

const ChannelSchema = z.object({
  code: z.string().min(1).max(40).regex(/^[a-z][a-z0-9_]*$/, 'snake_case 영문/숫자만'),
  label: z.string().min(1).max(40),
  description: z.string().max(200).optional().nullable(),
  icon: z.string().max(40).optional().nullable(),
  selectableInAgentForm: z.boolean(),
  isAgentDefault: z.boolean(),
  sortOrder: z.coerce.number().int().min(0).max(9999),
});

export type ChannelActionState = {
  ok: boolean; message?: string; fieldErrors?: Record<string, string>;
};

function shapeFieldErrors(err: z.ZodError<unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const path = issue.path.join('.') || '_';
    if (!out[path]) out[path] = issue.message;
  }
  return out;
}

export async function createTicketChannelAction(
  _prev: ChannelActionState | undefined, formData: FormData,
): Promise<ChannelActionState> {
  const user = await requireRole(['admin']);
  const raw = { /* §5.2 W2 처리 헬퍼 인라인 */ };
  const parsed = ChannelSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: '입력값을 확인해주세요',
      fieldErrors: shapeFieldErrors(parsed.error) };
  }
  const result = await createTicketChannel(parsed.data);
  if (!result.ok) {
    if (result.message === 'DUPLICATE_CODE') {
      return { ok: false, fieldErrors: { code: '이미 존재하는 코드입니다' } };
    }
    return { ok: false, message: '저장 실패' };
  }
  logActivity({ userId: user.id, action: 'master.channel.create',
    targetType: 'ticket_channel', targetId: result.id!, payload: parsed.data });
  revalidateTag('ticket-channels');
  revalidatePath('/admin/master/ticket-channels');
  redirect('/admin/master/ticket-channels');
}

// updateTicketChannelAction, toggleTicketChannelAction (activate/deactivate) 유사 구조
// 비활성화 액션은 §9.1 시스템 채널 보호 가드 추가
```

**권한**: `requireRole(['admin'])` — 매니저는 채널 마스터 편집 불가 (어드민 전용)

---

## 6. UI 컴포넌트 명세

### 6.1 어드민 마스터 페이지

#### `/admin/master/ticket-channels` (목록)

```
┌────────────────────────────────────────────────────────┐
│ ← 어드민 / 마스터                          [+ 신규 추가] │
│                                                        │
│ 유입 채널                                              │
│ 호텔리어가 어떤 경로로 문의를 보내왔는지 추적합니다.    │
├────────────────────────────────────────────────────────┤
│  ┌──┬──────┬────────┬────────┬─────┬────────┬───┐    │
│  │  │ 코드 │ 라벨   │ 아이콘  │ 정렬 │ 폼노출  │   │    │
│  ├──┼──────┼────────┼────────┼─────┼────────┼───┤    │
│  │🌐 │ web  │ 웹      │ Globe  │  10  │  ❌    │ ⋮ │    │
│  │📞 │phone │ 전화    │ Phone  │  20  │ ✅ 기본│ ⋮ │    │
│  │🤖 │chatbot│ 챗봇   │ Bot    │  30  │  ❌    │ ⋮ │    │
│  │💬 │kakao │ 카카오톡│ Messa..│  40  │  ✅    │ ⋮ │    │
│  │✉️ │email │ 이메일  │ Mail   │  50  │  ✅    │ ⋮ │    │
│  │🚶 │walk_in│ 방문   │ Foot...│  60  │  ✅    │ ⋮ │    │
│  └──┴──────┴────────┴────────┴─────┴────────┴───┘    │
└────────────────────────────────────────────────────────┘
```

- 비활성(`is_active=false`)은 옅게 표시 + 행에 "비활성" 뱃지
- ⋮ 메뉴: 수정 / 비활성화(소프트) / 활성화 (CLAUDE.md 5번 원칙)
- 모바일: 카드뷰 (CLAUDE.md 4번 원칙)
- EmptyState: "아직 채널이 없습니다. 시드를 먼저 실행해주세요."

#### `/admin/master/ticket-channels/new`

```
┌────────────────────────────────────────────────────────┐
│ ← 유입 채널 목록                                       │
│                                                        │
│ 새 유입 채널                                           │
├────────────────────────────────────────────────────────┤
│ 코드 *           [______________] snake_case (예: kakao)│
│ 라벨 *           [______________] 사용자 표시 (예: 카카오톡)│
│ 설명             [______________]                       │
│ 아이콘           [Lucide 이름 선택 ▾] 미리보기 [💬]    │
│ 정렬 순서        [40____]                               │
│                                                        │
│ ☑ 대리 접수 폼 드롭다운에 노출                          │
│ ☐ 대리 접수 폼 기본 선택값 (현재 'phone'에서 변경됨)    │
│                                                        │
│                              [취소] [저장]              │
└────────────────────────────────────────────────────────┘
```

**isAgentDefault 가드**: 저장 시 기존 default 채널의 isAgentDefault=false 자동 토글 (UI 가이드 메시지 표시). DB 제약은 걸지 않음 (어드민 직접 관리).

#### `/admin/master/ticket-channels/[id]`

상세/수정 페이지. `new` 페이지와 동일한 `<ChannelForm>` 컴포넌트 재사용, 초기값만 채움.

### 6.2 전화 접수 폼 변경 (Q-3 톤 다듬기)

#### Before (현재)

```
전화 접수
고객과의 통화 내용을 직접 입력하여 티켓을 발급합니다.
```

#### After

```
대리 접수
전화·카카오톡·이메일 등 외부 채널로 들어온 문의를 매니저가 대신 접수합니다.

[유입 채널 *]  [전화 ▾]
[호텔 *]      [────── 선택 ──────▾]
...
```

#### `phone-ticket-form.tsx` 변경 핵심

```tsx
type ChannelOption = { code: string; label: string; isAgentDefault: boolean };

export function PhoneTicketForm({
  channels,  // ← 신규 prop
  hotels, productCategories, ...
}: {
  channels: ChannelOption[];
  ...
}) {
  // 기본값: isAgentDefault=true인 채널 (시드상 'phone')
  const [channel, setChannel] = useState<string>(
    channels.find((c) => c.isAgentDefault)?.code ?? channels[0]?.code ?? 'phone'
  );

  // 폼 상단에 Select 추가 (호텔 위에)
  return (
    <form ...>
      <Card>
        <CardContent ...>
          <div>
            <Label required title="유입 채널" error={fieldErrors.channel} />
            <Select value={channel} onChange={(e) => setChannel(e.target.value)} disabled={pending}>
              {channels.map((c) => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))}
            </Select>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              고객이 어떤 경로로 문의를 보내왔는지 선택해주세요.
            </p>
          </div>
          {/* 기존 호텔/접수자/제품/유형/긴급도... */}
        </CardContent>
      </Card>
    </form>
  );
}

// FormData submit 시
fd.append('channel', channel);  // 신규 (Q-1: 액션에서 마스터 IN 절 검증)

// ─── W1 처리 ───
// 기존 코드: fd.append('customFields', JSON.stringify({ from: 'phone' }))
// 변경 후: channel이 정식 컬럼이므로 customFields.from 불필요 → 라인 자체 삭제.
// (customFields에 추가할 데이터가 없으면 append 자체를 생략. parseTicketFormData는
//  빈 customRaw를 undefined로 처리하므로 안전 — TicketCreateSchema.customFields가
//  optional이라 무영향)
```

#### `page.tsx` 변경

```tsx
import { listAgentSelectableChannels } from '@/lib/services/master-ticket-channels';

const [hotelsResult, productCategories, ..., channels] = await Promise.all([
  ...,
  listAgentSelectableChannels(),
]);

return (
  <PageHeader title="대리 접수" description="전화·카카오·이메일 등 외부 채널 문의 접수..." />
  <PhoneTicketForm channels={channels.map(c => ({ code: c.code, label: c.label, isAgentDefault: c.isAgentDefault }))} ... />
);
```

### 6.3 티켓 상세 라벨 표시 (Q-4)

#### W3 처리: Lucide 정적 import + ICON_MAP 화이트리스트

검증자 지적대로 `import * as LucideIcons from 'lucide-react'`는 tree-shaking을 무효화하여 클라이언트 번들 크기를 600KB+ 증가시킬 수 있다. 시드 6종 + 운영 확장 후보 아이콘을 명시적으로 등록한다.

#### 헬퍼 강화 (`lib/ticket-channel-label.ts`)

```ts
import {
  Globe, Phone, Bot, MessageCircle, Mail, Footprints,
  MessageSquare, Smartphone, Send, Building, Tag,
  type LucideIcon,
} from 'lucide-react';
import type { TicketChannelRow } from '@/db/schema';

/**
 * 허용된 Lucide 아이콘 화이트리스트.
 * 어드민이 새 아이콘 필요 시 이 맵에 추가 후 마스터에서 선택 (배포 필요).
 * 미등록 이름은 fallback Tag 아이콘 사용.
 */
export const CHANNEL_ICON_MAP: Record<string, LucideIcon> = {
  Globe, Phone, Bot, MessageCircle, Mail, Footprints,
  MessageSquare, Smartphone, Send, Building,
};
export const FALLBACK_ICON = Tag;

export type ChannelDisplay = {
  code: string;
  label: string;
  Icon: LucideIcon;
  isOrphan: boolean;
};

export function getChannelDisplay(
  code: string,
  map: Map<string, TicketChannelRow>,
): ChannelDisplay {
  const row = map.get(code);
  if (!row) {
    return { code, label: code, Icon: FALLBACK_ICON, isOrphan: true };
  }
  const Icon = row.icon ? (CHANNEL_ICON_MAP[row.icon] ?? FALLBACK_ICON) : FALLBACK_ICON;
  return { code, label: row.label, Icon, isOrphan: false };
}
```

#### 사용 예 (티켓 상세 페이지 공통)

```tsx
// app/(admin)/admin/tickets/[id]/page.tsx + app/tickets/[id]/page.tsx
import { getAllTicketChannelsMap } from '@/lib/services/master-ticket-channels';
import { getChannelDisplay } from '@/lib/ticket-channel-label';

const channelMap = await getAllTicketChannelsMap();
const channelDisplay = getChannelDisplay(ticket.channel, channelMap);
const { Icon: ChannelIcon } = channelDisplay;

<MetaRow
  icon={<ChannelIcon className="h-3.5 w-3.5" />}
  label="유입 채널"
  value={
    <span className={channelDisplay.isOrphan ? 'text-orange-600' : ''}>
      {channelDisplay.label}
      {channelDisplay.isOrphan && <span className="ml-1 text-xs">(마스터 미등록)</span>}
    </span>
  }
/>
```

#### 어드민 폼 — 아이콘 선택 UI

`channel-form.tsx`에서 아이콘 입력 필드는 `<input type="text">` 대신 **CHANNEL_ICON_MAP의 키를 옵션으로 가진 콤보박스 + 실시간 미리보기**로 구현:

```tsx
import { CHANNEL_ICON_MAP, FALLBACK_ICON } from '@/lib/ticket-channel-label';

const iconKeys = Object.keys(CHANNEL_ICON_MAP).sort();
const PreviewIcon = CHANNEL_ICON_MAP[icon] ?? FALLBACK_ICON;

<div>
  <Label title="아이콘" />
  <div className="flex items-center gap-2">
    <Select value={icon} onChange={(e) => setIcon(e.target.value)}>
      <option value="">— 없음 —</option>
      {iconKeys.map((k) => <option key={k} value={k}>{k}</option>)}
    </Select>
    <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border bg-slate-50 dark:bg-slate-900">
      <PreviewIcon className="h-4 w-4" />
    </span>
  </div>
  <p className="mt-1 text-xs text-slate-500">새 아이콘이 필요하면 CHANNEL_ICON_MAP에 추가 후 배포</p>
</div>
```

기존 하드코드 `channelLabel()` 함수와 인라인 삼항 분기는 **삭제**.

**번들 영향 비교**:
| 방식 | 번들 증가 | tree-shaking |
|:-|:-|:-:|
| ❌ `import * as` | ~600KB | 무효화 |
| ✅ named import 11종 | ~5KB | 정상 |

---

## 7. 권한 / 보안 매트릭스

### 7.1 페이지/액션 권한

| 리소스 | 호텔리어 | 매니저 | 어드민 |
|:-|:-:|:-:|:-:|
| `/admin/master/ticket-channels` (조회) | ❌ | ❌ | ✅ |
| `/admin/master/ticket-channels/*` (편집) | ❌ | ❌ | ✅ |
| 채널 활성화/비활성화 (soft delete) | ❌ | ❌ | ✅ (단, `web`/`chatbot` 시스템 채널 제외 — §9.1) |
| `/admin/tickets/new-by-phone` (대리 접수) | ❌ | ✅ | ✅ |
| 유입 채널 드롭다운 선택 | ❌ | ✅ | ✅ |
| `/tickets/new` (셀프 접수, web 고정) | ✅ | ✅ | ✅ |

### 7.2 보안 검증 (Q-1 기반)

| 시나리오 | 동작 |
|:-|:-|
| 클라이언트가 임의 channel='evil' 전송 | Zod parse → `isAgentChannelCodeValid` → DB 조회 → 미존재 → 400 + `fieldErrors.channel` |
| 클라이언트가 비활성(`is_active=false`) channel 전송 | 위와 동일 (`isAgentChannelCodeValid`가 `is_active=true` 필터링) |
| 클라이언트가 `selectableInAgentForm=false`인 channel ('web') 전송 | 위와 동일 거부 |
| channel 누락 (formData에 없음) | `parseTicketFormData`에서 `'phone'` fallback → 기존 동작과 동일 |

---

## 8. 시나리오 (E2E 후보)

### 8.1 핵심 시나리오 (7건)

| ID | 시나리오 | 기대 결과 |
|:-:|:-|:-|
| TC-01 | 어드민이 `/admin/master/ticket-channels` 진입 | 6개 시드 채널 행 표시, 'web'/'chatbot' 폼노출 ❌, 'phone' 기본 ✅ |
| TC-02 | 어드민이 신규 채널 'sms' 추가 (라벨 'SMS', icon 'MessageSquare') | 목록 7번째 줄에 표시, DB에 INSERT |
| TC-03 | 어드민이 'kakao' 라벨 → '카톡' 변경 | 갱신 즉시 목록 반영, 다른 페이지 캐시 무효화(`revalidateTag`) |
| TC-04 | 어드민이 'walk_in' 비활성화 | 폼 드롭다운에서 사라짐, 기존 티켓 상세 라벨은 '방문'으로 정상 표시 |
| TC-05 | 매니저가 `/admin/tickets/new-by-phone`에서 'kakao' 선택 → 저장 | DB tickets.channel='kakao', 상세 페이지 라벨 '카카오톡' |
| TC-06 | 클라이언트가 임의 channel='evil' POST 전송 | 400 응답, `fieldErrors.channel` |
| TC-07 | 호텔리어가 `/tickets/new` 진입 → 접수 | 채널 드롭다운 없음, DB tickets.channel='web' (변경 없음) |

### 8.2 회귀 시나리오 (3건)

| ID | 시나리오 |
|:-:|:-|
| R-01 | 기존 'phone' 티켓 상세 표시 — 마이그레이션 후에도 '전화' 라벨 정상 |
| R-02 | 매니저가 폼 채널 미선택 시 기본값 'phone' 자동 선택 |
| R-03 | 마스터 캐시 무효화 — 채널 라벨 수정 후 5분 내 모든 사용처 반영 |

---

## 9. 운영 / 일관성 고려

### 9.1 활성 상태 관리

- 시드 6종 중 `web`, `chatbot`은 시스템 보호 채널 (어드민이 비활성화하지 못하게)
  → UI에서 비활성화 버튼 disabled + 호버 툴팁 "시스템 채널은 비활성화할 수 없습니다"
  → 백엔드에서도 deactivateTicketChannel 호출 시 code='web'/'chatbot' 거부

### 9.2 마스터 캐시 일관성

- 모든 쓰기 액션에서 `revalidateTag('ticket-channels')` 호출
- 캐시 TTL 5분 → 어드민 편집 즉시 반영 (Tag 무효화) + 5분 fallback

### 9.3 `customFields.from = 'phone'` 처리

- 기존 코드: `phone-ticket-form.tsx:100` `fd.append('customFields', JSON.stringify({ from: 'phone' }))`
- 변경 후: channel 컬럼이 정식 필드이므로 customFields의 `from` 키는 **삭제**
- 기존 티켓 데이터의 `customFields.from` 값은 보존 (마이그레이션 무수정)

### 9.4 알림 채널과의 명명 충돌 (Plan §6 D1)

- 어드민 사이드바 명명:
  - 🎯 **유입 채널** (`ticket_channels`) — 본 Phase 신규
  - 🔔 **알림 템플릿** (`notification_templates`) — 기존
- 알림 템플릿 내부 `channel: 'sms' | 'email'` 필드는 "알림 수단"으로 별도 표기 검토 (별도 PR)

---

## 10. Open Questions / 후속 Phase

| ID | 항목 | 처리 시점 |
|:-:|:-|:-|
| **Q-1** | Lucide 아이콘 화이트리스트 (현재 동적 `(Icons as any)[name]`은 잘못된 이름 시 undefined → fallback `Tag`) | 본 Phase 수용 (마스터 입력 화면에서 아이콘 미리보기 + 알려진 이름만 노출하는 콤보박스 권장) |
| **Q-2** | `isAgentDefault=true` 1개 강제 (트랜잭션으로 기존 default 토글) | 본 Phase 자동 토글 구현 (UI 가이드 메시지) |
| **Q-3** | 'web'/'chatbot' 시스템 채널 보호 | §9.1 구현 |
| **Q-4** | 채널별 자동 라우팅·SLA (예: 'phone'은 P1 자동 격상) | Non-Goal (별도 Phase) |
| **Q-5** | 티켓 리스트/칸반 채널 뱃지 (P1-N) | 별도 Phase (Q-4 결정대로 본 Phase는 상세에만) |
| **Q-6** | 채널 통계 대시보드 (DI-XX) | Phase 9+ |

---

## 11. 검증 자체평가 (Match 예상)

| 항목 | Plan 명세 | Design 반영 | 일치 |
|:-|:-|:-|:-:|
| Goals G1~G5 | 명시 | §1, §6 모두 반영 | ✅ |
| Scope P0-A~P0-I | 9개 | §1.1, §1.2에 매핑 완료 | ✅ |
| Scope P1-J~P1-N | 5개 | P1-J(IMPL 갱신) §1.2, P1-K(사이드바) §9.4, P1-L(톤) §6.2, P1-M/N 분리 | ✅ |
| Non-Goals | 5개 | 본 Design에서 명시적 미포함 확인 | ✅ |
| Risk C1~C3 | 마이그레이션 | §3.1 단일 트랜잭션 SQL로 해소 | ✅ |
| Risk D1, D2 | UX 중복 | §9.4 명명 정리 + §6.2 selectableInAgentForm 가드 | ✅ |
| Risk E1~E4 | 구현 | §5.1 Zod superRefine, §4.1 cache, §9.1 보호, §6.3 헬퍼 통합 | ✅ |
| Risk R1~R3 | 회귀 | §8.2 R-01~R-03 시나리오 명시 | ✅ |
| Q-1~Q-4 결정 | Plan §8 | §0, §3, §5, §6에 반영 | ✅ |

**예상 Match Rate**: 95%+

---

## 12. 다음 단계 (Do)

### 12.1 권장 구현 순서

1. **DB 스키마** (`ticket-channels.ts` + `tickets.ts` 변경)
2. **마이그레이션 SQL** 작성 + dev 적용 (`drizzle-kit push`)
3. **시드** 추가 + 실행
4. **서비스 레이어** (`master-ticket-channels.ts`, `ticket-channel-label.ts`)
5. **Server Actions** (`master-ticket-channels-actions.ts` + `ticket-actions.ts` 수정)
6. **어드민 페이지** (목록 → 신규 → 상세, `_components/channel-form.tsx`)
7. **전화 접수 폼** 드롭다운 추가 + 톤 다듬기
8. **티켓 상세** 라벨 마스터화 (2곳)
9. **빌드 + 타입체크**
10. **E2E 회귀** (기존 9건 + TC-01~TC-07 신규)
11. **IMPLEMENTATION_PLAN.md** 갱신
12. **사이드바 메뉴** 추가

### 12.2 시간 추정 갱신

| 단계 | 추정 |
|:-|:-:|
| DB + 마이그레이션 + 시드 | 30분 |
| 서비스 + Actions | 30분 |
| 어드민 페이지 3개 + 폼 | 60분 |
| 전화 접수 폼 수정 | 30분 |
| 라벨 통합 + 빌드 | 30분 |
| E2E + 검증 | 30분 |
| **합계** | **약 3.5시간** |

---

## 부록 A. 빌드 / 의존 그래프

```
ticket-channels.ts (Schema)
        ↑
master-ticket-channels.ts (Service)
        ↑                           ↑
master-ticket-channels-actions.ts   ticket-actions.ts (수정)
        ↑                           ↑
admin master pages              new-by-phone form (수정)
                                    ↑
                                getAllTicketChannelsMap
                                    ↑
                                ticket-channel-label.ts (헬퍼)
                                    ↑
                                tickets/[id] pages (수정 2곳)
```

순환 의존 없음 ✅

## 부록 B. 시드 코드 (TypeScript)

```ts
// db/seed.ts 추가
import { ticketChannels } from './schema/ticket-channels';

const TICKET_CHANNEL_SEED = [
  { code: 'web',     label: '웹',       icon: 'Globe',         sortOrder: 10, selectableInAgentForm: false, isAgentDefault: false },
  { code: 'phone',   label: '전화',     icon: 'Phone',         sortOrder: 20, selectableInAgentForm: true,  isAgentDefault: true  },
  { code: 'chatbot', label: '챗봇',     icon: 'Bot',           sortOrder: 30, selectableInAgentForm: false, isAgentDefault: false },
  { code: 'kakao',   label: '카카오톡', icon: 'MessageCircle', sortOrder: 40, selectableInAgentForm: true,  isAgentDefault: false },
  { code: 'email',   label: '이메일',   icon: 'Mail',          sortOrder: 50, selectableInAgentForm: true,  isAgentDefault: false },
  { code: 'walk_in', label: '방문',     icon: 'Footprints',    sortOrder: 60, selectableInAgentForm: true,  isAgentDefault: false },
];

for (const row of TICKET_CHANNEL_SEED) {
  await db.insert(ticketChannels).values(row).onConflictDoNothing();
}
console.log(`[seed] ticket_channels: ${TICKET_CHANNEL_SEED.length}개 처리 완료`);
```
