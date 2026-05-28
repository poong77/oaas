/**
 * `checklists`, `checklist_steps` — SF-02, SF-04 (Phase 4 트러블슈팅).
 *
 * 모델:
 *   - 체크리스트 = 다단계 분기 진단표.
 *   - 단계는 `step_no` 오름차순으로 진행.
 *   - 각 단계는 yes/no 두 선택지를 가지며 각 선택지마다 다음 동작이 정해진다:
 *       'next'      → step_no + 1 카드로 진행
 *       'resolved'  → "🎉 해결됨" 결과 → checklists.resolved_count +1
 *       'escalate'  → "이슈 접수가 필요해요" → checklists.escalated_count +1
 *
 * 단계 enum 이름: `checklist_step_action_kind`
 *   (테이블 이름 `checklist_steps`와의 충돌 회피 + Phase 0 룰셋 준수)
 *
 * 인덱스:
 *   - (checklist_id, step_no) UNIQUE — 같은 체크리스트에 같은 step_no 두 개 금지
 */

import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { commonColumns } from './_shared';

/** 체크리스트 단계 분기 동작. enum 이름은 테이블 이름과 별개로 한다. */
export const checklistStepActionEnum = pgEnum('checklist_step_action_kind', [
  'next',
  'resolved',
  'escalate',
]);

export type ChecklistStepAction =
  (typeof checklistStepActionEnum.enumValues)[number];

export const checklists = pgTable(
  'checklists',
  {
    ...commonColumns(),
    productCode: text('product_code').notNull(),
    issueType: text('issue_type'),
    title: text('title').notNull(),
    description: text('description'),
    sortOrder: integer('sort_order').notNull().default(0),
    viewCount: integer('view_count').notNull().default(0),
    resolvedCount: integer('resolved_count').notNull().default(0),
    escalatedCount: integer('escalated_count').notNull().default(0),
  },
  (table) => [
    index('checklists_product_sort_idx').on(table.productCode, table.sortOrder),
    index('checklists_active_product_idx').on(
      table.isActive,
      table.productCode,
    ),
  ],
);

export const checklistSteps = pgTable(
  'checklist_steps',
  {
    ...commonColumns(),
    checklistId: uuid('checklist_id')
      .notNull()
      .references(() => checklists.id, { onDelete: 'cascade' }),
    stepNo: integer('step_no').notNull(),
    title: text('title').notNull(),
    bodyMarkdown: text('body_markdown'),
    conditionYesAction: checklistStepActionEnum('condition_yes_action')
      .notNull()
      .default('next'),
    conditionNoAction: checklistStepActionEnum('condition_no_action')
      .notNull()
      .default('escalate'),
    yesLabel: text('yes_label').notNull().default('예'),
    noLabel: text('no_label').notNull().default('아니오'),
  },
  (table) => [
    uniqueIndex('checklist_steps_checklist_step_uq').on(
      table.checklistId,
      table.stepNo,
    ),
  ],
);

export type Checklist = typeof checklists.$inferSelect;
export type NewChecklist = typeof checklists.$inferInsert;
export type ChecklistStep = typeof checklistSteps.$inferSelect;
export type NewChecklistStep = typeof checklistSteps.$inferInsert;
