/**
 * Drizzle 스키마 진입점.
 *
 * Phase 1 + 2 + 3 + 4 + 5 시점:
 *   - hotels, users, categories, solution_link_presets, hotel_solution_links, activity_logs
 *   - service_status (Phase 2)
 *   - articles, article_feedback (Phase 3)
 *   - faqs, checklists, checklist_steps (Phase 4)
 *   - tickets, ticket_messages, ticket_attachments, ticket_form_fields,
 *     notification_logs (Phase 5)
 *
 * 다음 Phase에서 추가될 예정:
 *   - notices (Phase 7)
 *   - notification_templates, system_settings, quick_actions,
 *     role_starters, popular_keywords, ticket_feedback, chatbot_sessions (Phase 9+)
 *
 * 공통 컬럼 헬퍼: `./_shared.ts`
 */

export * from './_shared';
export * from './hotels';
export * from './users';
export * from './categories';
export * from './solution-links';
export * from './activity-logs';
export * from './service-status';
export * from './articles';
export * from './article-feedback';
export * from './faqs';
export * from './checklists';
export * from './tickets';
export * from './ticket-messages';
export * from './ticket-attachments';
export * from './ticket-form-fields';
export * from './notification-logs';
