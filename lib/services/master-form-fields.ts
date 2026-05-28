/**
 * 마스터 — ticket_form_fields (Phase 9).
 *
 * 어드민이 제품별 동적 폼 필드를 정의. (Phase 5 마이그레이션 완료, UI는 Phase 9).
 * productCode NULL이면 전 제품 공통 필드.
 */

import 'server-only';
import { and, asc, eq, isNull, or } from 'drizzle-orm';

import { db } from '@/db';
import {
  ticketFormFields,
  type NewTicketFormField,
  type TicketFormField,
  type TicketFormFieldInput,
  type TicketFormFieldOption,
} from '@/db/schema';

export async function listFormFields(
  options: { productCode?: string | null; includeInactive?: boolean } = {},
): Promise<TicketFormField[]> {
  if (!db) return [];
  try {
    const conditions = [];
    if (!options.includeInactive)
      conditions.push(eq(ticketFormFields.isActive, true));
    if (options.productCode !== undefined) {
      // productCode === null 이면 전체 공통만, 문자열이면 그것 + 공통
      if (options.productCode === null) {
        conditions.push(isNull(ticketFormFields.productCode));
      } else {
        const orExpr = or(
          isNull(ticketFormFields.productCode),
          eq(ticketFormFields.productCode, options.productCode),
        );
        if (orExpr) conditions.push(orExpr);
      }
    }
    const where = conditions.length === 0 ? undefined : and(...conditions);
    return await db
      .select()
      .from(ticketFormFields)
      .where(where)
      .orderBy(
        asc(ticketFormFields.productCode),
        asc(ticketFormFields.sortOrder),
        asc(ticketFormFields.label),
      );
  } catch (err) {
    console.error('[master-form-fields.listFormFields] 실패:', err);
    return [];
  }
}

export async function getFormFieldById(
  id: string,
): Promise<TicketFormField | null> {
  if (!db) return null;
  try {
    const rows = await db
      .select()
      .from(ticketFormFields)
      .where(eq(ticketFormFields.id, id))
      .limit(1);
    return rows[0] ?? null;
  } catch (err) {
    console.error('[master-form-fields.getFormFieldById] 실패:', err);
    return null;
  }
}

export type FormFieldWriteInput = {
  productCode?: string | null;
  fieldKey: string;
  label: string;
  inputType: TicketFormFieldInput;
  options?: TicketFormFieldOption[];
  required?: boolean;
  sortOrder?: number;
  helpText?: string | null;
};

export async function createFormField(
  input: FormFieldWriteInput,
): Promise<{ ok: boolean; id?: string; message?: string }> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  try {
    const row: NewTicketFormField = {
      productCode: input.productCode ?? null,
      fieldKey: input.fieldKey,
      label: input.label,
      inputType: input.inputType,
      options: input.options ?? [],
      required: input.required ?? false,
      sortOrder: input.sortOrder ?? 0,
      helpText: input.helpText ?? null,
    };
    const [created] = await db
      .insert(ticketFormFields)
      .values(row)
      .returning({ id: ticketFormFields.id });
    return { ok: true, id: created?.id };
  } catch (err) {
    console.error('[master-form-fields.createFormField] 실패:', err);
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'INTERNAL_ERROR',
    };
  }
}

export async function updateFormField(
  id: string,
  input: Partial<FormFieldWriteInput>,
): Promise<{ ok: boolean; message?: string }> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  try {
    await db
      .update(ticketFormFields)
      .set({
        ...(input.label !== undefined ? { label: input.label } : {}),
        ...(input.inputType !== undefined
          ? { inputType: input.inputType }
          : {}),
        ...(input.options !== undefined ? { options: input.options } : {}),
        ...(input.required !== undefined ? { required: input.required } : {}),
        ...(input.sortOrder !== undefined
          ? { sortOrder: input.sortOrder }
          : {}),
        ...(input.helpText !== undefined ? { helpText: input.helpText } : {}),
      })
      .where(eq(ticketFormFields.id, id));
    return { ok: true };
  } catch (err) {
    console.error('[master-form-fields.updateFormField] 실패:', err);
    return { ok: false, message: 'INTERNAL_ERROR' };
  }
}

export async function setFormFieldActive(
  id: string,
  isActive: boolean,
): Promise<{ ok: boolean; message?: string }> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  try {
    await db
      .update(ticketFormFields)
      .set({ isActive })
      .where(eq(ticketFormFields.id, id));
    return { ok: true };
  } catch (err) {
    console.error('[master-form-fields.setFormFieldActive] 실패:', err);
    return { ok: false, message: 'INTERNAL_ERROR' };
  }
}
