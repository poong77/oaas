/**
 * Drizzle 스키마 진입점.
 *
 * Phase 1 + 2 + 3 + 4 + 5 + 6 + 7 + 9 시점:
 *   - hotels, users, categories, solution_link_presets, hotel_solution_links, activity_logs
 *   - service_status (Phase 2)
 *   - articles, article_feedback (Phase 3)
 *   - faqs, checklists, checklist_steps (Phase 4)
 *   - tickets, ticket_messages, ticket_attachments, ticket_form_fields,
 *     notification_logs (Phase 5)
 *   - ticket_feedback (Phase 6)
 *   - notices (Phase 7)
 *   - notification_templates, quick_reply_templates, quick_actions,
 *     role_starters, system_settings (Phase 9 — 어드민 마스터 데이터)
 *
 * 다음 Phase에서 추가될 예정:
 *   - popular_keywords, chatbot_sessions (P2 이후)
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
export * from './ticket-feedback';
export * from './ticket-channels';
export * from './notices';
// Phase 9 — 어드민 마스터 데이터
export * from './notification-templates';
export * from './quick-reply-templates';
export * from './quick-actions';
export * from './role-starters';
export * from './system-settings';
