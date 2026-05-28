# Phase 4 빌드 가이드 (2026-05-28)

CTO Lead 세션 내에서 Bash 실행이 불가하여 아래 명령을 메인 세션에서 직접 실행해주세요.

## 1) 마이그레이션 생성 + 적용

```bash
cd /Users/marc/프로젝트/통합AS

# placeholder 0002_swift_quasar.sql 삭제 (drizzle-kit이 정식 생성)
rm -f db/migrations/0002_swift_quasar.sql

# 신규 스키마(faqs, checklists, checklist_steps) 마이그레이션 자동 생성
npx drizzle-kit generate

# 결과 확인 (0002_xxx.sql + meta/0002_snapshot.json + meta/_journal.json 업데이트)
ls -la db/migrations/

# Neon DB에 적용
npm run db:migrate

# 시드 (FAQ 12 + 체크리스트 3, idempotent — 기존 데이터 보존)
npm run db:seed
```

## 2) 빌드 점검

```bash
npm run build
```

빌드 통과 후 dev 서버에서 시연:

```bash
npm run dev
```

확인할 페이지:

- `/faq` — PMS 필터, 아코디언 펼침, 도움됨 클릭
- `/troubleshoot` — 체크리스트 카드 3개
- `/troubleshoot/[id]` — 단계 진행 → "해결됨" or "접수 필요"
- `/admin/faqs` (manager@oa.local / oa1234!) — 리스트 + 위/아래 정렬 이동
- `/admin/faqs/new` — 마크다운 split-view 작성
- `/admin/checklists` — 리스트 + 단계 수 + 해결률
- `/admin/checklists/[id]` — 메타 폼 + 단계 인라인 편집

## 3) Git 커밋 + Push

```bash
git add .
git commit -m "feat(sf): Phase 4 — FAQ + 트러블슈팅 체크리스트 + 어드민 콘텐츠 관리

- DB: faqs, checklists, checklist_steps 테이블 추가
  + enum checklist_step_action_kind (next/resolved/escalate)
- /faq: placeholder 교체 (제품·유형 필터 + 아코디언 + 도움됨 + URL hash)
- /troubleshoot, /troubleshoot/[id]: 트러블슈팅 허브 + 단계 진행 UI
- /admin/faqs/* : FAQ CRUD + 정렬순 이동
- /admin/checklists/* : 체크리스트 + 단계 인라인 편집
- /search?tab=faq : FAQ 검색 활성화
- GNB 어드민 nav에 FAQ, 체크리스트 메뉴 추가
- 시드: FAQ 12건 (제품×2), 체크리스트 3건 (총 11단계)
- 감사 로그: faq.*, checklist.*, checklist.step.*

Co-Authored-By: Claude <noreply@anthropic.com>"

git push
```

## 트러블슈팅

### "duplicate enum value" 에러
이미 운영 중인 Neon DB에 같은 이름의 enum이 있다면 `drizzle-kit migrate`가 실패할 수 있습니다. 그 경우 Neon Console에서 직접 확인:

```sql
SELECT typname FROM pg_type WHERE typname = 'checklist_step_action_kind';
```

### 빌드 시 NULL 가능성 경고
`f.summary30s`, `f.issueType` 같은 nullable 필드는 모두 사전 체크가 되어 있어 빌드는 통과해야 합니다.

### `useConfirmDialog` 미마운트 경고
`ConfirmDialogHost`는 `app/layout.tsx`에서 한 번 마운트되어 있어야 합니다 (Phase 1 완료 상태).
