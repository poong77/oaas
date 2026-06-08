'use server';

/**
 * Ticket Server Actions — Phase 5 IC-01, IC-04, IC-06, IC-07, IC-08, IS-02, IS-04.
 *
 * Public (호텔리어 가능):
 *   - createTicketAction          IC-01 / 호텔리어 자체 접수
 *   - addPublicMessageAction      IS-02 / 호텔리어가 추가 답변 작성
 *
 * Manager+Admin:
 *   - createTicketByPhoneAction   IC-04 / 매니저 전화 접수
 *   - addInternalMemoAction       IC-07 / 내부 메모
 *   - addAdminPublicMessageAction 매니저 공개 답변
 *   - changeStatusAction          IS-04 / 상태 변경
 *   - assignTicketAction          IS-04 / 담당자·마감일 변경
 *   - escalateToDevAction         IC-08 / Dev 에스컬
 */

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { requireAuth, requireRole } from '@/lib/permissions';
import { logActivity } from '@/lib/audit';
import {
  addMessage,
  assignTicket,
  changeStatus,
  createTicket,
  escalateToDev,
  submitFeedback,
  type CreateTicketInput,
} from '@/lib/services/tickets';
import { isAgentChannelCodeValid } from '@/lib/services/master-ticket-channels';
import type {
  TicketContactMethod,
  TicketFeedbackRating,
  TicketStatus,
} from '@/db/schema';

const CONTACT_METHODS = ['sms', 'email'] as const;
const URGENCY_CODES = ['p1', 'p2', 'p3'] as const;

// ─────────────────────────────────────────────────────────────────────
// 공통 검증 스키마
// ─────────────────────────────────────────────────────────────────────

const AttachmentSchema = z.object({
  blobUrl: z.string().url(),
  pathname: z.string().min(1),
  originalName: z.string().min(1).max(300),
  mimeType: z.string().max(200).optional().nullable(),
  sizeBytes: z.number().int().min(0).max(60 * 1024 * 1024), // 60MB hard limit
});

const ContactMethodArraySchema = z
  .array(z.enum(CONTACT_METHODS))
  .max(2)
  .default([]);

const TicketCreateSchema = z.object({
  productCode: z.string().min(1, '제품을 선택하세요').max(60),
  issueType: z.string().min(1, '유형을 선택하세요').max(60),
  urgency: z.enum(URGENCY_CODES),
  impactScope: z.string().max(60).optional().nullable(),
  title: z.string().min(2, '제목을 2자 이상 입력하세요').max(200),
  content: z
    .string()
    .min(10, '내용을 10자 이상 자세히 적어주세요')
    .max(20000),
  contactMethods: ContactMethodArraySchema,
  attachments: z.array(AttachmentSchema).max(20).default([]),
  /** 폼 컨텍스트 (escalate 경로 등) */
  customFields: z.record(z.unknown()).optional(),
});

export type TicketCreateState = {
  ok: boolean;
  ticketId?: string;
  ticketNo?: string;
  message?: string;
  fieldErrors?: Record<string, string>;
};

function shapeFieldErrors(err: z.ZodError<unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const path = issue.path.join('.') || '_';
    if (!out[path]) out[path] = issue.message;
  }
  return out;
}

/**
 * createTicket()이 반환하는 message 코드 → 사용자용 한글 문구.
 * raw PostgreSQL 메시지(예: 'duplicate key value violates ...')는
 * 사용자에게 노출하지 않는다.
 */
function humanizeCreateTicketError(message: string): string {
  switch (message) {
    case 'DB_NOT_READY':
      return '서버가 준비되지 않았습니다. 잠시 후 다시 시도해주세요.';
    case 'INSERT_FAILED':
      return '티켓을 저장하지 못했습니다. 다시 시도해주세요.';
    case 'TICKET_NO_CONFLICT':
      return '티켓 번호 발급 중 충돌이 발생했습니다. 잠시 후 다시 시도해주세요.';
    case 'INTERNAL_ERROR':
      return '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
    default:
      // raw DB 메시지가 노출되지 않도록 일반 문구로 래핑
      return '티켓 접수에 실패했습니다. 잠시 후 다시 시도해주세요.';
  }
}

// ─────────────────────────────────────────────────────────────────────
// 호텔리어 접수
// ─────────────────────────────────────────────────────────────────────

export async function createTicketAction(
  _prev: TicketCreateState | undefined,
  formData: FormData,
): Promise<TicketCreateState> {
  const user = await requireAuth('/tickets/new');

  const raw = parseTicketFormData(formData);
  const parsed = TicketCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: '입력값을 확인해주세요',
      fieldErrors: shapeFieldErrors(parsed.error),
    };
  }

  const input: CreateTicketInput = {
    hotelId: user.hotelId,
    reporterId: user.id,
    productCode: parsed.data.productCode,
    issueType: parsed.data.issueType,
    urgency: parsed.data.urgency,
    impactScope: parsed.data.impactScope ?? null,
    title: parsed.data.title,
    content: parsed.data.content,
    customFields: parsed.data.customFields ?? {},
    channel: 'web',
    contactMethods: parsed.data.contactMethods as TicketContactMethod[],
    attachments: parsed.data.attachments,
  };

  const result = await createTicket(input);
  if (!result.ok) {
    return { ok: false, message: humanizeCreateTicketError(result.message) };
  }

  logActivity({
    userId: user.id,
    action: 'ticket.create',
    targetType: 'ticket',
    targetId: result.ticketId,
    payload: {
      ticketNo: result.ticketNo,
      productCode: parsed.data.productCode,
      urgency: parsed.data.urgency,
      channel: 'web',
    },
  });

  revalidatePath('/tickets');
  revalidatePath('/admin/tickets');
  // redirect는 마지막에 throw 형태로 동작. 다만 useFormState 함수형에서는 redirect 직후 state 반환이 의미 없으므로 호출부에서 처리.
  return { ok: true, ticketId: result.ticketId, ticketNo: result.ticketNo };
}

// ─────────────────────────────────────────────────────────────────────
// 매니저 전화 접수
// ─────────────────────────────────────────────────────────────────────

const PhoneTicketSchema = TicketCreateSchema.extend({
  hotelId: z.string().uuid().optional().nullable(),
  reporterId: z.string().uuid().optional().nullable(),
  /** Plan Q-1: 마스터 IN 절 검증은 액션에서 별도 수행 (DB 의존). */
  channel: z.string().min(1, '유입 채널을 선택하세요').max(60),
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
    return {
      ok: false,
      message: '입력값을 확인해주세요',
      fieldErrors: shapeFieldErrors(parsed.error),
    };
  }

  // Plan Q-1: 마스터 IN 절 검증 (selectable=true && active=true 만 허용)
  const channelValid = await isAgentChannelCodeValid(parsed.data.channel);
  if (!channelValid) {
    return {
      ok: false,
      message: '유효하지 않은 유입 채널입니다',
      fieldErrors: { channel: '드롭다운에서 다시 선택해주세요' },
    };
  }

  const input: CreateTicketInput = {
    hotelId: parsed.data.hotelId ?? null,
    reporterId: parsed.data.reporterId ?? user.id,
    productCode: parsed.data.productCode,
    issueType: parsed.data.issueType,
    urgency: parsed.data.urgency,
    impactScope: parsed.data.impactScope ?? null,
    title: parsed.data.title,
    content: parsed.data.content,
    customFields: parsed.data.customFields ?? {},
    channel: parsed.data.channel,
    contactMethods: parsed.data.contactMethods as TicketContactMethod[],
    attachments: parsed.data.attachments,
  };

  const result = await createTicket(input);
  if (!result.ok) {
    return { ok: false, message: humanizeCreateTicketError(result.message) };
  }

  logActivity({
    userId: user.id,
    action: 'ticket.create_by_phone',
    targetType: 'ticket',
    targetId: result.ticketId,
    payload: {
      ticketNo: result.ticketNo,
      hotelId: parsed.data.hotelId,
      reporterId: parsed.data.reporterId,
      productCode: parsed.data.productCode,
      urgency: parsed.data.urgency,
      channel: parsed.data.channel,
    },
  });

  revalidatePath('/admin/tickets');
  return { ok: true, ticketId: result.ticketId, ticketNo: result.ticketNo };
}

// ─────────────────────────────────────────────────────────────────────
// 답변 / 내부 메모
// ─────────────────────────────────────────────────────────────────────

const MessageSchema = z.object({
  ticketId: z.string().uuid(),
  content: z.string().min(1, '내용을 입력하세요').max(20000),
});

export async function addPublicMessageAction(
  formData: FormData,
): Promise<{ ok: boolean; message?: string }> {
  const user = await requireAuth();
  const parsed = MessageSchema.safeParse({
    ticketId: formData.get('ticketId'),
    content: (formData.get('content') ?? '').toString().trim(),
  });
  if (!parsed.success) {
    return { ok: false, message: '내용을 입력해주세요' };
  }
  const result = await addMessage({
    ticketId: parsed.data.ticketId,
    authorId: user.id,
    kind: 'public',
    content: parsed.data.content,
  });
  if (result.ok) {
    logActivity({
      userId: user.id,
      action: 'ticket.message.public',
      targetType: 'ticket',
      targetId: parsed.data.ticketId,
    });
    revalidatePath(`/tickets/${parsed.data.ticketId}`);
    revalidatePath(`/admin/tickets/${parsed.data.ticketId}`);
  }
  return result;
}

export async function addAdminPublicMessageAction(
  formData: FormData,
): Promise<{ ok: boolean; message?: string }> {
  const user = await requireRole(['manager', 'admin']);
  const parsed = MessageSchema.safeParse({
    ticketId: formData.get('ticketId'),
    content: (formData.get('content') ?? '').toString().trim(),
  });
  if (!parsed.success) {
    return { ok: false, message: '내용을 입력해주세요' };
  }
  const result = await addMessage({
    ticketId: parsed.data.ticketId,
    authorId: user.id,
    kind: 'public',
    content: parsed.data.content,
  });
  if (result.ok) {
    logActivity({
      userId: user.id,
      action: 'ticket.message.public_admin',
      targetType: 'ticket',
      targetId: parsed.data.ticketId,
    });
    revalidatePath(`/tickets/${parsed.data.ticketId}`);
    revalidatePath(`/admin/tickets/${parsed.data.ticketId}`);
  }
  return result;
}

export async function addInternalMemoAction(
  formData: FormData,
): Promise<{ ok: boolean; message?: string }> {
  const user = await requireRole(['manager', 'admin']);
  const parsed = MessageSchema.safeParse({
    ticketId: formData.get('ticketId'),
    content: (formData.get('content') ?? '').toString().trim(),
  });
  if (!parsed.success) {
    return { ok: false, message: '내용을 입력해주세요' };
  }
  const result = await addMessage({
    ticketId: parsed.data.ticketId,
    authorId: user.id,
    kind: 'internal_memo',
    content: parsed.data.content,
  });
  if (result.ok) {
    logActivity({
      userId: user.id,
      action: 'ticket.message.internal',
      targetType: 'ticket',
      targetId: parsed.data.ticketId,
    });
    revalidatePath(`/admin/tickets/${parsed.data.ticketId}`);
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────
// 상태 / 담당자 / 에스컬
// ─────────────────────────────────────────────────────────────────────

const StatusSchema = z.object({
  ticketId: z.string().uuid(),
  nextStatus: z.enum(['received', 'in_progress', 'completed']),
  /** 'true'면 원콜 해결로 기록 (완료 전환 시에만 의미). */
  oneCallResolved: z.enum(['true', 'false']).optional(),
});

export async function changeStatusAction(
  formData: FormData,
): Promise<{ ok: boolean; message?: string }> {
  const user = await requireRole(['manager', 'admin']);
  const parsed = StatusSchema.safeParse({
    ticketId: formData.get('ticketId'),
    nextStatus: formData.get('nextStatus'),
    oneCallResolved: formData.get('oneCallResolved') ?? undefined,
  });
  if (!parsed.success) return { ok: false, message: '잘못된 요청' };
  const result = await changeStatus({
    ticketId: parsed.data.ticketId,
    actorId: user.id,
    nextStatus: parsed.data.nextStatus as TicketStatus,
    oneCallResolved:
      parsed.data.oneCallResolved === undefined
        ? undefined
        : parsed.data.oneCallResolved === 'true',
  });
  if (result.ok) {
    logActivity({
      userId: user.id,
      action: 'ticket.status_change',
      targetType: 'ticket',
      targetId: parsed.data.ticketId,
      payload: { to: parsed.data.nextStatus },
    });
    revalidatePath(`/tickets/${parsed.data.ticketId}`);
    revalidatePath(`/admin/tickets/${parsed.data.ticketId}`);
    revalidatePath('/admin/tickets');
  }
  return result;
}

const AssignSchema = z.object({
  ticketId: z.string().uuid(),
  assigneeId: z.string().uuid().nullable().optional(),
  dueDate: z.string().optional().nullable(),
});

export async function assignTicketAction(
  formData: FormData,
): Promise<{ ok: boolean; message?: string }> {
  const user = await requireRole(['manager', 'admin']);
  const rawAssignee = (formData.get('assigneeId') ?? '').toString();
  const rawDue = (formData.get('dueDate') ?? '').toString();
  const parsed = AssignSchema.safeParse({
    ticketId: formData.get('ticketId'),
    assigneeId: rawAssignee || null,
    dueDate: rawDue || null,
  });
  if (!parsed.success) return { ok: false, message: '잘못된 요청' };

  let dueDate: Date | null = null;
  if (parsed.data.dueDate) {
    const d = new Date(parsed.data.dueDate);
    if (!Number.isNaN(d.getTime())) dueDate = d;
  }

  const result = await assignTicket({
    ticketId: parsed.data.ticketId,
    actorId: user.id,
    assigneeId: parsed.data.assigneeId ?? null,
    dueDate,
  });
  if (result.ok) {
    logActivity({
      userId: user.id,
      action: 'ticket.assign',
      targetType: 'ticket',
      targetId: parsed.data.ticketId,
      payload: { assigneeId: parsed.data.assigneeId, dueDate: parsed.data.dueDate },
    });
    revalidatePath(`/admin/tickets/${parsed.data.ticketId}`);
    revalidatePath('/admin/tickets');
  }
  return result;
}

const EscalateSchema = z.object({
  ticketId: z.string().uuid(),
  reason: z
    .string()
    .min(10, 'Dev 팀에게 전달할 이유를 10자 이상 적어주세요')
    .max(2000),
});

export async function escalateToDevAction(
  formData: FormData,
): Promise<{ ok: boolean; message?: string }> {
  const user = await requireRole(['manager', 'admin']);
  const parsed = EscalateSchema.safeParse({
    ticketId: formData.get('ticketId'),
    reason: (formData.get('reason') ?? '').toString().trim(),
  });
  if (!parsed.success) {
    return {
      ok: false,
      message:
        parsed.error.issues[0]?.message ?? 'Dev 에스컬 사유를 확인하세요',
    };
  }
  const result = await escalateToDev({
    ticketId: parsed.data.ticketId,
    actorId: user.id,
    reason: parsed.data.reason,
  });
  if (result.ok) {
    logActivity({
      userId: user.id,
      action: 'ticket.escalate_dev',
      targetType: 'ticket',
      targetId: parsed.data.ticketId,
    });
    revalidatePath(`/admin/tickets/${parsed.data.ticketId}`);
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────
// Phase 6 — 칸반 드래그앤드롭 (IS-04 칸반)
// ─────────────────────────────────────────────────────────────────────

/**
 * 칸반에서 카드 드래그앤드롭으로 상태 변경.
 *
 * 기존 changeStatusAction과 비교:
 *   - 권한·검증·호출 함수 동일
 *   - activity_logs action만 `ticket.kanban_moved`로 구분 (운영 분석 용)
 *   - revalidatePath에 `/admin/tickets/kanban` 추가
 *
 * 분리 이유: 상태 변경의 "맥락"을 감사 로그로 추적 가능하게 (리스트뷰 vs 칸반).
 */
export async function moveTicketStatusAction(
  formData: FormData,
): Promise<{ ok: boolean; message?: string }> {
  const user = await requireRole(['manager', 'admin']);
  const parsed = StatusSchema.safeParse({
    ticketId: formData.get('ticketId'),
    nextStatus: formData.get('nextStatus'),
  });
  if (!parsed.success) return { ok: false, message: '잘못된 요청' };

  const result = await changeStatus({
    ticketId: parsed.data.ticketId,
    actorId: user.id,
    nextStatus: parsed.data.nextStatus as TicketStatus,
  });
  if (result.ok) {
    logActivity({
      userId: user.id,
      action: 'ticket.kanban_moved',
      targetType: 'ticket',
      targetId: parsed.data.ticketId,
      payload: { to: parsed.data.nextStatus },
    });
    revalidatePath('/admin/tickets');
    revalidatePath('/admin/tickets/kanban');
    revalidatePath(`/admin/tickets/${parsed.data.ticketId}`);
    revalidatePath(`/tickets/${parsed.data.ticketId}`);
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────
// Phase 6 — ⑦ 호텔리어 피드백
// ─────────────────────────────────────────────────────────────────────

const RATING_CODES = ['resolved', 'partial', 'unresolved'] as const;

const FeedbackSchema = z.object({
  ticketId: z.string().uuid(),
  rating: z.enum(RATING_CODES),
  comment: z.string().max(2000).optional().nullable(),
});

export async function submitFeedbackAction(
  formData: FormData,
): Promise<{ ok: boolean; message?: string }> {
  const user = await requireAuth();
  const parsed = FeedbackSchema.safeParse({
    ticketId: formData.get('ticketId'),
    rating: formData.get('rating'),
    comment: (formData.get('comment') ?? '').toString().trim() || null,
  });
  if (!parsed.success) {
    return {
      ok: false,
      message:
        parsed.error.issues[0]?.message ?? '평가 값을 확인해주세요',
    };
  }

  const result = await submitFeedback({
    ticketId: parsed.data.ticketId,
    rating: parsed.data.rating as TicketFeedbackRating,
    comment: parsed.data.comment ?? null,
    userId: user.id,
  });
  if (result.ok) {
    logActivity({
      userId: user.id,
      action: 'ticket.feedback_submitted',
      targetType: 'ticket',
      targetId: parsed.data.ticketId,
      payload: { rating: parsed.data.rating },
    });
    revalidatePath(`/tickets/${parsed.data.ticketId}`);
    revalidatePath(`/admin/tickets/${parsed.data.ticketId}`);
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────
// 헬퍼
// ─────────────────────────────────────────────────────────────────────

function parseTicketFormData(formData: FormData): Record<string, unknown> {
  const get = (k: string) => (formData.get(k) ?? '').toString();
  const contactRaw = formData.getAll('contactMethods').map((v) => v.toString());
  const contactMethods = contactRaw.filter((v): v is 'sms' | 'email' =>
    CONTACT_METHODS.includes(v as (typeof CONTACT_METHODS)[number]),
  );
  const attachmentsRaw = get('attachments');
  let attachments: unknown = [];
  if (attachmentsRaw) {
    try {
      attachments = JSON.parse(attachmentsRaw);
    } catch {
      attachments = [];
    }
  }
  const customRaw = get('customFields');
  let customFields: Record<string, unknown> | undefined;
  if (customRaw) {
    try {
      const parsed = JSON.parse(customRaw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        customFields = parsed;
      }
    } catch {
      // ignore
    }
  }
  return {
    productCode: get('productCode').trim(),
    issueType: get('issueType').trim(),
    urgency: get('urgency').trim(),
    impactScope: get('impactScope').trim() || null,
    title: get('title').trim(),
    content: get('content').trim(),
    contactMethods,
    attachments,
    customFields,
  };
}

// ─────────────────────────────────────────────────────────────────────
// 호텔리어 접수 후 redirect helper
// ─────────────────────────────────────────────────────────────────────

/**
 * 클라이언트에서 호출용. 성공 시 server-side redirect.
 * useTransition + startTransition으로 호출.
 */
export async function redirectToTicketAction(ticketId: string): Promise<void> {
  await requireAuth();
  redirect(`/tickets/${ticketId}?created=1`);
}
