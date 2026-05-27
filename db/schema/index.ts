/**
 * Drizzle 스키마 진입점.
 *
 * Phase 0: 골격만 비워둔다. 실제 26개 테이블은 Phase 1부터 도메인별로 작성:
 *   - db/schema/users.ts        (users, hotels — Phase 1)
 *   - db/schema/categories.ts   (categories, ticket_form_fields — Phase 1)
 *   - db/schema/tickets.ts      (tickets, ticket_messages, ticket_attachments — Phase 5)
 *   - db/schema/articles.ts     (articles, faqs, checklists — Phase 3, 4)
 *   - db/schema/notices.ts      (notices, service_status — Phase 7)
 *   - db/schema/system.ts       (notification_templates, notification_logs, system_settings,
 *                                activity_logs, quick_actions, role_starters, popular_keywords,
 *                                solution_link_presets, ticket_feedback, chatbot_sessions — Phase 1+)
 *
 * 각 파일은 여기서 re-export하여 `import * as schema from '@/db/schema'`로 사용.
 *
 * 공통 컬럼 (CLAUDE.md):
 *   id (uuid PK), created_at, updated_at, is_active
 */

// Phase 1 진입 시 아래 주석 해제 + 파일 생성:
// export * from './users';
// export * from './categories';
// export * from './tickets';
// export * from './articles';
// export * from './notices';
// export * from './system';

export {};
