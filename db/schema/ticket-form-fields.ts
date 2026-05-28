/**
 * `ticket_form_fields` — 어드민이 편집하는 동적 접수 폼 필드 정의.
 *
 * Phase 5는 빈 테이블로 마이그레이션만 수행 (UI는 하드코딩 폼).
 * Phase 9에서 어드민 편집 UI를 추가하면 폼이 이 정의를 따르게 된다.
 *
 * 운영 규칙:
 *   - `productCode`가 NULL이면 전 제품 공통 필드.
 *   - input_type='select'일 때 options jsonb에 `[{value, label}]` 배열을 저장.
 *   - 정렬은 sort_order ASC.
 */

import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  uniqueIndex,
  boolean,
} from 'drizzle-orm/pg-core';
import { commonColumns } from './_shared';

export const ticketFormFieldInputEnum = pgEnum('ticket_form_field_input', [
  'text',
  'textarea',
  'select',
  'number',
  'date',
  'file',
]);

export type TicketFormFieldInput =
  (typeof ticketFormFieldInputEnum.enumValues)[number];

export type TicketFormFieldOption = {
  value: string;
  label: string;
};

export const ticketFormFields = pgTable(
  'ticket_form_fields',
  {
    ...commonColumns(),
    /** NULL이면 전 제품 공통. */
    productCode: text('product_code'),
    fieldKey: text('field_key').notNull(),
    label: text('label').notNull(),
    inputType: ticketFormFieldInputEnum('input_type').notNull().default('text'),
    options: jsonb('options')
      .notNull()
      .default([])
      .$type<TicketFormFieldOption[]>(),
    required: boolean('required').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    helpText: text('help_text'),
  },
  (table) => [
    uniqueIndex('ticket_form_fields_product_key_uq').on(
      table.productCode,
      table.fieldKey,
    ),
    index('ticket_form_fields_product_sort_idx').on(
      table.productCode,
      table.sortOrder,
    ),
  ],
);

export type TicketFormField = typeof ticketFormFields.$inferSelect;
export type NewTicketFormField = typeof ticketFormFields.$inferInsert;
