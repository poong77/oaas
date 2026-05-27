/**
 * Drizzle 스키마 진입점.
 *
 * Phase 1 시점:
 *   - hotels, users, categories, solution_link_presets, hotel_solution_links, activity_logs
 *
 * 다음 Phase에서 추가될 예정:
 *   - tickets, ticket_messages, ticket_attachments, ticket_form_fields (Phase 5)
 *   - articles, faqs, checklists, checklist_steps (Phase 3, 4)
 *   - notices, service_status (Phase 7)
 *   - notification_templates, notification_logs, system_settings, quick_actions,
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
