# Phase 9 — 어드민 마스터 데이터 편집 (Design)

> 작성일: 2026-05-28
> 범위: `/admin/master/*` 9개 페이지 + 신규 DB 테이블 5종 + 홈 페이지 동적 전환

## 1. 목표

- 매니저/어드민이 시스템 마스터 데이터를 직접 편집할 수 있는 통합 메뉴 (`/admin/master`) 구축
- 기존 하드코딩(quick_actions, role_starters, notification_templates)을 DB로 이관 (graceful fallback)
- 어드민 nav에 "마스터 데이터" 단일 항목만 추가 (기존 메뉴 유지)

## 2. DB 스키마 추가 (5 테이블)

### 2.1 `notification_templates`
SMS/Email 알림 템플릿. `notification_channel` enum (Phase 5) 재사용.

| 컬럼 | 타입 | 비고 |
|------|------|------|
| id | uuid PK | |
| channel | notification_channel | 'sms' | 'email' | 'slack' (enum 재사용, master는 sms/email만 사용) |
| event_key | text NOT NULL | 'ticket.received' 등 |
| subject | text NULL | email 전용 |
| body | text NOT NULL | `{{변수}}` 치환 |
| (channel, event_key) | unique index | |

### 2.2 `quick_reply_templates`
티켓 응대용 빠른 답변 템플릿.

| 컬럼 | 타입 |
|------|------|
| id, title, content, category | text |
| sort_order | integer DEFAULT 0 |

### 2.3 `quick_actions`
홈 페이지 ④ "자주 찾는 작업" 카드.

| 컬럼 | 타입 |
|------|------|
| id, label, icon, link_url | text |
| sort_order | integer DEFAULT 0 |
| visible | boolean DEFAULT true |

### 2.4 `role_starters`
홈 페이지 ⑤ "역할별 시작하기" 카드.

| 컬럼 | 타입 |
|------|------|
| role_key | text UNIQUE (front/sales/housekeeping/manager/new_open) |
| label, description | text |
| article_ids | uuid[] |
| sort_order | integer DEFAULT 0 |

### 2.5 `system_settings`
어드민 전용 key-value 설정.

| 컬럼 | 타입 |
|------|------|
| key | text UNIQUE |
| value | jsonb NOT NULL |
| description | text |
| updated_by | uuid → users(id) ON DELETE SET NULL |

### 2.6 Enum 명명 규칙 학습 (Phase 5/6 메모리)
- 모든 신규 enum/테이블 이름 다르게 유지 (이번엔 enum 추가 없음 — 모두 재사용 또는 text)

## 3. 페이지 구조

```
/admin/master                                  인덱스 카드 9개
/admin/master/categories                       4 탭 (product/issue_type/urgency/impact)
/admin/master/notification-templates           리스트 + [id] 편집
/admin/master/quick-replies                    리스트 + [id] 편집
/admin/master/quick-actions                    리스트 + [id] 편집
/admin/master/role-starters                    리스트 + [id] 편집
/admin/master/solution-links                   리스트 + [id] 편집 (기존 solution_link_presets)
/admin/master/system-settings                  키-값 일괄 폼 (어드민 only)
/admin/master/form-fields                      리스트 + [id] + new (ticket_form_fields)
```

권한:
- 기본: 매니저+어드민
- system-settings: 어드민 only (`requireRole(['admin'])`)

## 4. Services & Server Actions

| 도메인 | Service | Actions |
|--------|---------|---------|
| categories | `master-categories.ts` | `master-category-actions.ts` |
| notification_templates | `master-templates.ts` | `master-template-actions.ts` |
| quick_replies | `master-quick-replies.ts` | `master-quick-reply-actions.ts` |
| quick_actions | `master-quick-actions.ts` | `master-quick-action-actions.ts` |
| role_starters | `master-role-starters.ts` | `master-role-starter-actions.ts` |
| solution_link_presets | `master-solution-links.ts` | `master-solution-link-actions.ts` |
| system_settings | `master-system-settings.ts` | `master-system-settings-actions.ts` |
| ticket_form_fields | `master-form-fields.ts` | `master-form-field-actions.ts` |

모든 Service는 `'server-only'` + `if (!db) return [...]` 가드 + try/catch.
모든 Action은 `requireRole` + `logActivity(action: 'master.<domain>.<verb>')` + revalidate.

## 5. 홈 페이지 동적 전환

`app/page.tsx`에서 `listVisibleQuickActions()`, `listActiveRoleStarters()` 호출:
- DB에 row 있으면 → DB값
- 빈 결과/오류 → 기존 `_constants.ts`의 하드코딩 fallback

icon은 lucide 이름 문자열로 저장 → 클라이언트 컴포넌트에서 `lucide-react`의 dynamic lookup. 안전을 위해 `icon-resolver.tsx` 헬퍼 추가.

## 6. `lib/notifications/templates.ts` 통합

기존 함수형 빌더 (`buildAccountInvite`, `buildTicketReceived` 등) 유지 + DB fetch wrapper 추가:
```ts
async function loadTemplate(eventKey, channel): Promise<DbTemplate | null>
function renderTemplate(body, vars): string  // {{key}} 치환
```
- DB row 없거나 fetch 실패 → 기존 하드코딩 빌더 fallback
- subject만 DB로, body html은 여전히 builder 사용 (HTML 복잡도 분리)
  - 실제 마이그레이션은 단순 text body로 시작, 향후 HTML 옮길 여지

## 7. 어드민 Nav

`admin-nav.tsx`의 `ALL_TABS` 하단에 단일 항목 추가:
```ts
{ href: '/admin/master', label: '마스터 데이터', icon: Database, roles: ['manager', 'admin'] }
```

기존 메뉴는 그대로 유지.

## 8. 시드 보강

`db/seed.ts` 마지막에 추가 (idempotent):
- `notification_templates`: 5건 (`ticket.received`, `ticket.in_progress`, `ticket.completed`, `account.invite`, `account.password_reset`) × sms+email = 10건
- `quick_actions`: 8건
- `role_starters`: 5건
- `system_settings`: 5건
- `quick_reply_templates`: 3건

## 9. 마이그레이션

- 파일: `db/migrations/0006_phase9_master_placeholder.sql`
- placeholder: 실제 SQL은 `drizzle-kit generate` 또는 `push`로 재생성 예정
- 본 파일은 메인 세션 마이그레이션 흐름에서 정식 SQL로 대체됨

## 10. 작업량 우선순위

핵심 (Phase 9 완료):
1. DB 스키마 5종 + index export
2. 마이그레이션 placeholder
3. Services 8종 (간략 CRUD)
4. Server Actions 8종
5. /admin/master 인덱스 + 5개 핵심 페이지
6. 어드민 nav 추가
7. 홈 동적 fetch
8. templates.ts DB wrapper
9. 시드 보강

축약 (간단 CRUD만):
- quick-replies, solution-links: 단순 리스트 + 편집 폼만
- form-fields: 리스트 + 편집 (옵션은 JSON textarea)

## 11. 검증 체크포인트

- [ ] 5개 신규 테이블 + 어드민 페이지 9개 빌드 통과
- [ ] /admin/master 인덱스 카드 9개 표시
- [ ] quick_actions DB 추가 시 홈 즉시 반영
- [ ] system_settings는 어드민만 진입
- [ ] 시드 idempotent (재실행 시 0건 신규)
