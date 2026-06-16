/**
 * Drizzle 스키마 진입점.
 *
 * Phase 1 + 2 + 3 + 4 + 5 + 6 + 7 + 9 시점:
 *   - hotels, users, categories, solution_link_presets, hotel_solution_links, activity_logs
 *   - service_status (Phase 2)
 *   - articles, article_feedback (Phase 3)
 *   - faqs, checklists, checklist_steps (Phase 4)
 *   - tickets, ticket_messages, ticket_attachments,
 *     notification_logs (Phase 5)
 *   - ticket_feedback (Phase 6)
 *   - notices (Phase 7)
 *   - notification_templates, quick_reply_templates,
 *     role_starters, system_settings (Phase 9 — 어드민 마스터 데이터)
 *   - 삭제됨 2026-06-09: ticket_form_fields, quick_actions (마스터DB 재구성)
 *   - popular_keywords (SS-04 — 인기검색어 하이브리드 큐레이션)
 *
 * 다음 Phase에서 추가될 예정:
 *   - chatbot_sessions (P2 이후)
 *
 * 공통 컬럼 헬퍼: `./_shared.ts`
 */

export * from './_shared';
export * from './hotels';
export * from './users';
export * from './categories';
export * from './solution-links';
export * from './hotel-managed-links';
// 호텔 ↔ Slack 채널 연동 (N:N) — 접수 알림 병행 발송
export * from './hotel-slack-channels';
export * from './activity-logs';
export * from './service-status';
// AC-11 — 셀프 비밀번호 찾기 토큰/코드
export * from './password-reset-tokens';
export * from './articles';
export * from './article-feedback';
export * from './faqs';
export * from './checklists';
export * from './tickets';
export * from './ticket-messages';
export * from './ticket-attachments';
export * from './notification-logs';
export * from './ticket-feedback';
export * from './ticket-channels';
export * from './notices';
// Phase 9 — 어드민 마스터 데이터
export * from './notification-templates';
export * from './quick-reply-templates';
// MSG-16 — 메일&문자 수동 발송 템플릿 (자주 쓰는 발송 양식)
export * from './manual-message-templates';
export * from './hotelier-templates';
export * from './role-starters';
export * from './system-settings';
export * from './popular-keywords';
// 공통 인프라 — 리치 에디터 자동 저장
export * from './editor-drafts';
// 동의어 사전 마스터 (검색 보강)
export * from './term-groups';
export * from './term-synonyms';
// 메뉴 구조 마스터 (도움말 아티클 menu_path 정본)
export * from './menu-taxonomies';
// 아티클 URL 리다이렉트 (slug 변경 시 옛 URL 보존)
export * from './article-redirects';
// 티켓 채번 카운터 (race-free atomic UPSERT)
export * from './ticket-no-counter';
// 운영시간 마스터 (P1: default + holidays / P2: overrides)
export * from './business-hours-default';
export * from './business-holidays';
export * from './business-hours-overrides';
// knowledge-base-overhaul (Phase 1 v1.3) — slug 채번 + 골격 마스터
export * from './article-seq-counters';
export * from './article-templates';
// 검색 품질 평가 (v1.6 Layer A) — 골든셋 + 평가 실행
export * from './search-eval';
// 검색 실사용 로그 (v1.6 Layer B) — 0건율·CTR·전환율
export * from './search-logs';
// ai-reply-assist — AI 답변 초안 모델 마스터 (어드민 편집)
export * from './ai-models';
