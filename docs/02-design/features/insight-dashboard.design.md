# 설계 — 운영 인사이트 대시보드 (DI-01)

> 기능 ID: DI-01 · 우선순위 P1 · 경로 `/admin/insights/dashboard` · 권한 매니저+어드민
> 관련 계획: `docs/IMPLEMENTATION_PLAN.md` DI-01 노트 · 시각 목업: `docs/dev-logs/2026-06-02-insight-dashboard-mockup.html`

## 1. 목표
호텔리어 셀프서비스 → 문의 → 운영팀 처리 → Dev 이관 → 완료의 운영 흐름을 한 화면에서 모니터링한다. 새 페이지지만 기존 페이지와 동일한 디자인 수준(Card·필터·EmptyState·모바일 대응)을 유지한다.

## 2. 신규 스키마 (마이그레이션)
`db/schema/tickets.ts`에 2개 컬럼 추가. `drizzle-kit generate` → `migrate`로 적용 (push 금지 — 검색 인덱스 보존).
- `one_call_resolved boolean NOT NULL DEFAULT false` — 원콜 해결 여부. 담당자가 완료 처리 시 체크.
- `channels jsonb NOT NULL DEFAULT '[]'` (`string[]`) — 유입 채널 복수. 기존 `channel`(단일)은 primary로 유지. 비어있으면 `[channel]`로 간주.

## 3. 기간·필터
- 기간 칩: **어제 / 7일 / 30일** (KST, 오늘 제외). 기본 `30d`. 타입 `DashboardPeriod = 'yesterday' | '7d' | '30d'`.
- 제품 필터: `productCode`(전체 + categories type='product'). URL param `?period=&product=`.
- 기간 범위: `kstPeriodRange()` — 오늘 00:00 KST를 end로, N일 전 00:00을 start로 (오늘 제외). 어제=1, 7d=7, 30d=30.
- 코호트 일관성: 티켓 비율/유형 지표의 모집단은 **해당 기간에 생성(created_at)된 티켓**으로 통일.

## 4. 데이터 신호 정의 (실제 스키마 기준)
- **Dev개입(에스컬레이션)**: `slack_dev_thread_ts`는 현재 미사용. 신뢰 신호 = `ticket_messages` 중 `metadata->>'eventKey' = 'ticket.escalated_dev'` 행 존재. (escalateToDev가 internal_memo로 기록)
- **접수(착수)**: status가 received를 벗어난 상태(`in_progress`·`on_hold`·`completed`).
- **완료**: `status = 'completed'`.
- **완료 시각**: `ticket_messages` status_change 중 `metadata->>'to'='completed'`의 max(created_at). 없으면 `updated_at` 폴백.
- **첫 응답 시각**: 운영팀(작성자 role manager/admin) `kind='public'` 메시지의 min(created_at).
- **urgency P1 값**: `'p1'`.
- **영업일**: 주말(토·일) + `business_holidays`(is_active) 제외 일수.

## 5. 위젯 구성 (섹션 순서)
1. **액션카드 2** — 긴급 처리건(urgency='p1' AND status≠completed), 장기 지연건(미완료 AND 영업일 경과 > 3).
2. **핵심지표 3 (완료건 대비 비율, 도넛 미사용 — 비율 카드 3개)**: 모수=기간 내 완료 티켓.
   - 원콜완료 = `one_call_resolved=true` 비율
   - 원팀완료(자체해결) = Dev개입 없음 비율 (원콜+다회 포함)
   - Dev개입 = escalated_dev 신호 존재 비율
   - 원팀완료+Dev개입=100%, 원콜완료는 독립 부분집합(합산 아님).
3. **행위자 5단계 퍼널**: 검색(search_logs, 기간 내, 제품필터=productCode) → 문의(기간 내 생성 티켓) → 접수(착수) → Dev이관 → 완료. 단계 간 전환율 표시. 전화=직접접수·카카오/방문 없음 → deflection 미적용(검색 단계는 웹/챗봇 진입량 참고치).
4. **검색·호텔**:
   - 검색어 워드클라우드 — `search_logs.normalized_query` 빈도를 `loadSynonymIndex().termToGroupIds`로 대표어(`groupIdToTerms[gid][0]`=canonical) 집계. 미등록어는 원본 유지. 0건 결과 비율 높은 단어 강조. Top ~30.
   - 호텔별 문의 Top 15 — 기간 내 생성 티켓 GROUP BY hotel_id, 절대 건수 내림차순, hotels.name 조인.
5. **유입 분석**: 일자별×채널별 누적막대(건당 1회 집계, `channels.length>=2 ? '여럿' : channels[0]`), 유형별(issueType, 완료/처리중), 제품별 분포.
6. **처리·완료**: 상태분포(received/in_progress/on_hold/completed), 평균 첫 응답 시간(시간)·평균 해결 소요(영업일), Dev 에스컬레이션 백로그(미완료 escalated, 영업일 경과 desc, ~8행), 담당자별 처리(완료/처리중/보류/평균해결).

## 6. 서비스 (`lib/services/insights.ts`, server-only)
모든 쿼리 graceful(`if(!db) return empty`) + try/catch + `console.error`.

**구조 (성능 위해 통합)**: 단일 진입 `getDashboardData({period, productCode})`가
① `loadRangeTickets(start,end,product)`로 기간 코호트 티켓을 **1회 로드** →
② 보강 데이터를 `Promise.all`로 병렬 로드(`loadDevInvolvedSet`/`loadCompletedAtMap`/`loadFirstResponseMap`/`loadHotelNames`/`loadAssigneeNames`, 라벨 `loadCategoryLabelMaps`, 검색 `getSearchKeywords`+`getSearchTotal`, 영업일 `loadHolidaySet`) →
③ **순수 함수로 JS 집계**: `computeCompletion`/`computeFunnel`/`computeHotelTop15`/`computeChannelDaily`/`computeByType`/`computeByProduct`/`computeStatusDist`/`computeTimeMetrics`/`computeAssignees`.
전역 스냅샷(현재 미완료 기준)인 `getActionCards(holidays)`·`getDevBacklog(labels,holidays,8)`는 코호트와 무관하므로 별도 쿼리.
- export: `getDashboardData`, `getSearchKeywords`, 모든 결과 타입. 나머지 loader/compute는 모듈 내부.
- 반환 `DashboardData` = `{ actionCards, completion, funnel, keywords, hotels, channelDaily, byType, byProduct, statusDist, timeMetrics, devBacklog, assignees }`.
- 완료 시각: `completedAtMap.get(id) ?? updatedAt` 폴백(§4). 라벨 `loadCategoryLabelMaps()`. 영업일 `business-days.ts`의 `loadHolidaySet()`+`businessDaysBetween()`.
- 공용 상수/타입(`DASHBOARD_PERIODS`,`PERIOD_LABEL`,`DashboardPeriod`)은 클라이언트 안전 모듈 `insights-shared.ts`에 분리(클라이언트 필터가 server-only 그래프를 끌어오지 않도록).

## 7. UI 구현
- 차트: 대시보드 한정 **ECharts**(`echarts` + `echarts-wordcloud`) 도입. `<EChart option client wrapper>` (`'use client'`, dynamic import, dispose on theme change, resize observer). 단순 비율/카드/액션카드는 기존 CSS 패턴(slate 컬러).
- 페이지 `app/(admin)/admin/insights/dashboard/page.tsx` — Server Component, `requireRole(['manager','admin'])`, `export const dynamic='force-dynamic'`, searchParams Promise.
- 필터 `_components/dashboard-filters.tsx` — `'use client'`, Button(기간) + select(제품), useRouter+useTransition (search-logs-filters 패턴).
- 위젯 컴포넌트는 `_components/`에 분리. 색: 자체해결=emerald, Dev=rose, 원콜=brand, 채널/제품은 팔레트.
- 사이드바 `app/(admin)/admin/_data/nav-items.ts` insight 그룹에 `{ href:'/admin/insights/dashboard', label:'운영 대시보드', icon: LayoutDashboard, roles:['manager','admin'], group:'insight' }` 를 검색로그 위에 추가.

## 8. 비포함 (별도 Phase)
- 만족도 수집(검색/페이지/티켓 만족도 트리거 팝업·`satisfaction_surveys`) — 미포함.
- 호텔리어 로그인 수 위젯 — `user.login` 이벤트 계측 부재로 미포함.
- 호텔 정규화(객실당)·median/p90·재접수 등 고도화 — 후속.

## 9. 권한·예외
- 페이지 진입 `requireRole(['manager','admin'])` (호텔리어 notFound).
- 데이터 없음: 각 위젯 EmptyState 또는 0 표기. DB 미연결 시 전부 0/빈 배열 graceful.
