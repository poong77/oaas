# 코드 리뷰 — 운영 인사이트 대시보드 (DI-01)

> 일자: 2026-06-02 · 도구: bkit:code-review (code-analyzer) · 초기 Score 86/100 → 조치 후 빌드 통과

## 요약
- 리뷰 파일: 9 (insights·business-days·tickets schema·dashboard page/components·nav)
- 발견: Critical 1 · Major 3 · Minor 7
- 보안: 이슈 없음 (SQL 파라미터 바인딩·searchParams 화이트리스트·requireRole 가드)

## 조치 내역

### 🔴 Critical — 해결
- **`one_call_resolved` 쓰기 경로 부재 → "원콜완료" 항상 0%**
  - 조치: 완료 처리 흐름에 "원콜 해결" 체크박스 추가.
    - `lib/services/tickets.ts` `changeStatus`에 `oneCallResolved?` 추가(completed 전환 시 반영, 완료 유지 상태에서 플래그만 갱신도 지원).
    - `app/actions/ticket-actions.ts` `changeStatusAction` 스키마에 `oneCallResolved` 파싱.
    - `admin-ticket-actions.tsx` 완료 선택 시 체크박스 노출 + 전송. 상세 페이지에서 `ticket.oneCallResolved` 주입.

### 🟡 Major — 해결
- **`loadCategoryLabelMaps` 이중 호출**: 페이지에서 1회 로드 후 `getDashboardData({labels})`로 주입(중복 제거).
- **전건 JS 로딩 상한 부재**: `loadRangeTickets`에 `.limit(20000)` 안전 상한 + 후속(DB 집계 이관) 주석.
- **완료/첫응답 시각 텍스트 파싱 불안정**: `extract(epoch from max/min(...))`로 수신해 `new Date(sec*1000)` 명시 변환.

### 🟢 Minor — 해결
- 담당자 행 `key`를 `id`로(동명이인 충돌 방지) — `AssigneeRow.id` 추가.
- `echart.tsx` 인스턴스 타입을 `ECharts`로(`as unknown` 제거).
- 차트 option `useMemo`로 안정화(불필요 setOption 재실행 방지).
- 퍼널 전환율 분모 0일 때 `'—'` 표기.

### 보류(영향 경미·후속)
- `ticket-messages.ts` metadata 주석 snake_case 표기 stale(코드는 camelCase, 동작 정상).
- `bucketChannel` 빈 채널 '웹' 폴백 — 데이터 정합성 이슈 없어 유지.
- 평균→median/p90, 호텔 정규화, 캐시(unstable_cache) — 후속 고도화.

## 검증
- `npx tsc --noEmit` EXIT 0
- `npm run build` ✓ Compiled successfully · `/admin/insights/dashboard` 라우트 생성
