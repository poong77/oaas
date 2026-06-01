# search-logs — Design

> **Feature**: 어드민 > 인사이트 > 검색로그 — 호텔리어 실사용 검색 이력 열람
> **Phase**: Design (PDCA)
> **선행 문서**: [docs/01-plan/features/search-logs.plan.md](../../01-plan/features/search-logs.plan.md)
> **작성일**: 2026-06-01
> **상태**: APPROVED — Do 진입 가능

---

## 0. 개요

Plan에서 확정된 4개 결정(Q-1~Q-4)을 토대로 구현 명세를 확정한다.
**DB 스키마 변경 0건** — 기존 `search_logs` + `articles/faqs.helpful_*`를 조회 전용으로 펼친다.

| ID | 결정 | Design 반영 |
|:-:|:-|:-|
| Q-1 | 기간은 "어제"가 끝 (오늘 제외, KST) | §3 `kstPeriodRange` — KST 자정 [start,end) |
| Q-2 | 도움됨 = 도착 페이지 반응표(👍/👎) 집계 | §4 배치 조인 + §6 `<Helpful>` |
| Q-3 | 사이드바 인사이트 그룹 신설 | §7 nav-items 'insight' TabGroup |
| Q-4 | 읽기 전용 | 서비스에 write 경로 없음, 페이지는 RSC 조회만 |

---

## 1. 파일 변경 요약

### 1.1 신규 파일 (3개)

| 경로 | 역할 | 라인수 추정 |
|:-|:-|:-:|
| `app/(admin)/admin/insights/search-logs/page.tsx` | 서버 컴포넌트 (권한·조회·StatCard·Card·EmptyState) | ~135 |
| `app/(admin)/admin/insights/search-logs/_components/search-logs-filters.tsx` | 기간 필터 버튼 토글 (클라이언트) | ~50 |
| `app/(admin)/admin/insights/search-logs/_components/search-logs-list-client.tsx` | 테이블 + 모바일 카드뷰 + 반응표 + 페이지네이션 (클라이언트) | ~185 |

### 1.2 수정 파일 (2개)

| 경로 | 변경 내용 |
|:-|:-|
| `lib/services/search-logs.ts` | `listSearchLogs` + `kstPeriodRange`(private) + `buildOutflow`(private) + 타입(`SearchLogPeriod`/`HelpfulTally`/`SearchLogRow`/`SearchLogList`) 추가. 기존 함수 무변경 |
| `app/(admin)/admin/_data/nav-items.ts` | `TabGroup`에 `'insight'` 추가, 검색로그 NavItem 추가, `GROUP_ORDER`/`GROUP_LABEL`('인사이트') 갱신 |

---

## 2. 데이터 모델 (변경 없음 — 참조용)

```ts
// db/schema/search-logs.ts (기존)
searchLogs {
  ...commonColumns(),       // id, createdAt, updatedAt, isActive
  query, normalizedQuery,
  resultCounts (jsonb), totalResults, zeroResult,
  clicked, clickedKind, clickedRef, clickedPosition,
  ledToTicket, productCode, userId, role, sessionKey,
}
// 인덱스: created_idx, zero_idx, norm_idx, session_idx

// db/schema/articles.ts: helpfulYes/helpfulNo (integer, default 0)
// db/schema/faqs.ts:     helpfulYes/helpfulNo (integer, default 0)
```

조인 키:
- clickedKind='help' → `articles.slug = clickedRef`
- clickedKind='faq'  → `faqs.id = clickedRef`

---

## 3. 기간 경계 (Q-1) — `kstPeriodRange`

```ts
export type SearchLogPeriod = 'yesterday' | '7d' | '30d';

/**
 * 기간 → [start, end) UTC 경계 (KST 자정 정렬).
 * Vercel(UTC)에서도 KST 하루 단위로 자르기 위해 KST 날짜를 기준으로 계산.
 */
function kstPeriodRange(period: SearchLogPeriod): { start: Date; end: Date } {
  const todayKst = new Date()
    .toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' })
    .slice(0, 10);                          // 'YYYY-MM-DD'
  const end = new Date(`${todayKst}T00:00:00+09:00`);  // 오늘 00:00 KST = 어제의 끝
  const days = period === 'yesterday' ? 1 : period === '7d' ? 7 : 30;
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  return { start, end };
}
```

| period | 범위 (KST) |
|:-|:-|
| `yesterday` | 어제 00:00 ~ 오늘 00:00 (1일) |
| `7d` | 7일 전 00:00 ~ 오늘 00:00 |
| `30d` | 30일 전 00:00 ~ 오늘 00:00 |

모든 기간의 `end`는 **오늘 00:00 KST** — 오늘 검색은 항상 제외(Q-1).

---

## 4. 서비스 명세 — `listSearchLogs`

### 4.1 시그니처 / 반환 타입

```ts
export type HelpfulTally = { yes: number; no: number };

export type SearchLogRow = {
  id: string;
  query: string;
  createdAt: Date;
  dwellSeconds: number | null;     // 세션 체류시간 (초). 없으면 null
  helpful: HelpfulTally | null;    // 도착 페이지 반응표. 미클릭/대상없음 null
  outflowUrl: string | null;
  outflowLabel: string | null;
};

export type SearchLogList = {
  items: SearchLogRow[];
  total: number;
  page: number;
  pageSize: number;
  stats: { total: number; clicks: number; ticket: number; zero: number };
};

export async function listSearchLogs(input: {
  period: SearchLogPeriod;
  page?: number;
  pageSize?: number;
}): Promise<SearchLogList>;
```

- `page` 기본 1, 최소 1. `pageSize` 기본 30, 1~100 클램프.
- `db` null이면 빈 결과 반환 (graceful).

### 4.2 WHERE 조건 (Plan E2)

```ts
const where = and(
  gte(searchLogs.createdAt, start),
  lt(searchLogs.createdAt, end),
  eq(searchLogs.isActive, true),   // ← CLAUDE.md 리스트 원칙
);
```

### 4.3 세션 체류시간 (Plan P0-C / C3) — LEAD 윈도우

```ts
const dwellExpr = sql<number | null>`case
  when ${searchLogs.sessionKey} is null then null
  else extract(epoch from (
    coalesce(
      lead(${searchLogs.createdAt}) over (
        partition by ${searchLogs.sessionKey} order by ${searchLogs.createdAt}
      ),
      ${searchLogs.updatedAt}
    ) - ${searchLogs.createdAt}
  ))
end`;
```

- sessionKey null → null (단발 취급, UI "—")
- 같은 세션 내 다음 검색까지 간격(초). 다음 없으면 `updatedAt`(클릭/접수 사후 업데이트 시각)까지.
- 윈도우는 LIMIT/OFFSET 이전 평가 → 페이지 경계 무관 (C3).
- 음수 결과는 매핑 단계에서 null 처리.

### 4.4 메인 쿼리 + 통계 (Promise.all 병렬)

```ts
const [rows, statRows] = await Promise.all([
  db.select({ id, query, createdAt, clicked, clickedKind, clickedRef,
              ledToTicket, zeroResult, productCode, dwellSeconds: dwellExpr })
    .from(searchLogs).where(where)
    .orderBy(desc(searchLogs.createdAt))
    .limit(pageSize).offset((page - 1) * pageSize),
  db.select({
      total: sql`count(*)::int`,
      clicks: sql`count(*) filter (where ${searchLogs.clicked})::int`,
      ticket: sql`count(*) filter (where ${searchLogs.ledToTicket})::int`,
      zero: sql`count(*) filter (where ${searchLogs.zeroResult})::int`,
    }).from(searchLogs).where(where),
]);
```

### 4.5 반응표 배치 조인 (Q-2 / Plan C2) — N+1 방지

현재 페이지 rows에서 clicked help/faq의 ref만 dedupe하여 2쿼리:

```ts
const helpSlugs = [...new Set(rows.filter(r => r.clicked && r.clickedKind==='help' && r.clickedRef).map(r => r.clickedRef!))];
const faqIds    = [...new Set(rows.filter(r => r.clicked && r.clickedKind==='faq'  && r.clickedRef).map(r => r.clickedRef!))];

const [articleRows, faqRows] = await Promise.all([
  helpSlugs.length ? db.select({ slug, yes: helpfulYes, no: helpfulNo }).from(articles).where(inArray(articles.slug, helpSlugs)) : [],
  faqIds.length    ? db.select({ id,   yes: helpfulYes, no: helpfulNo }).from(faqs).where(inArray(faqs.id, faqIds)) : [],
]);

const helpfulBySlug = new Map(articleRows.map(a => [a.slug, { yes: a.yes, no: a.no }]));
const helpfulByFaq  = new Map(faqRows.map(f => [f.id,   { yes: f.yes, no: f.no }]));
```

- 빈 배열일 때 쿼리 생략 (불필요 DB 호출 방지).
- 매핑 시 Map 미스 → helpful null (C4 fallback).

### 4.6 유출 URL 복원 (Plan P0-E) — `buildOutflow`

```ts
function buildOutflow(row): { url: string | null; label: string | null } {
  if (row.clicked && row.clickedKind && row.clickedRef) {
    switch (row.clickedKind) {
      case 'help':  return { url: row.productCode ? `/help/${row.productCode}/${row.clickedRef}` : `/help/${row.clickedRef}`, label: '아티클' };
      case 'faq':   return { url: `/faq#faq-${row.clickedRef}`, label: 'FAQ' };
      case 'notice':return { url: `/notices/${row.clickedRef}`, label: '공지' };
      case 'incident': return { url: '/status', label: '서비스 상태' };
      default:      return { url: null, label: row.clickedKind };
    }
  }
  if (row.ledToTicket) return { url: '/tickets/new', label: '티켓 접수' };
  return { url: null, label: null };  // 이탈
}
```

### 4.7 행 매핑

```ts
const items = rows.map((r) => {
  const outflow = buildOutflow(r);
  const dwell = r.dwellSeconds == null ? null : Math.round(Number(r.dwellSeconds));
  let helpful = null;
  if (r.clicked && r.clickedRef) {
    if (r.clickedKind === 'help') helpful = helpfulBySlug.get(r.clickedRef) ?? null;
    else if (r.clickedKind === 'faq') helpful = helpfulByFaq.get(r.clickedRef) ?? null;
  }
  return {
    id: r.id, query: r.query, createdAt: r.createdAt,
    dwellSeconds: dwell != null && dwell >= 0 ? dwell : null,  // 음수 → null
    helpful, outflowUrl: outflow.url, outflowLabel: outflow.label,
  };
});
```

---

## 5. 페이지 명세 — `page.tsx`

```tsx
export const dynamic = 'force-dynamic';
export const metadata = { title: '검색로그 — OA 통합 AS 어드민' };

const VALID_PERIODS: SearchLogPeriod[] = ['yesterday', '7d', '30d'];

export default async function SearchLogsPage({ searchParams }) {
  await requireRole(['manager', 'admin']);            // E1
  const sp = await searchParams;
  const period = VALID_PERIODS.includes(sp.period) ? sp.period : '7d';  // 기본 7d
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1);

  const { items, total, pageSize, stats } = await listSearchLogs({ period, page, pageSize: 30 });
  const ctr = stats.total > 0 ? Math.round(stats.clicks / stats.total * 100) : 0;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="검색로그" description={`${PERIOD_LABEL[period]} 동안 ... ${total}건 ...`} />
      <SearchLogsFilters period={period} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="검색 수" value={stats.total} />
        <StatCard label="결과 클릭" value={stats.clicks} sub={`CTR ${ctr}%`} tone="success" />
        <StatCard label="티켓 전환" value={stats.ticket} tone="danger" />
        <StatCard label="결과없음" value={stats.zero} tone="warn" />
      </div>
      <Card><CardContent className="p-0">
        {items.length === 0
          ? <EmptyState icon={<Search/>} title="이 기간에 검색 이력이 없습니다" ... />
          : <SearchLogsListClient items={items} total={total} page={page} pageSize={pageSize} />}
      </CardContent></Card>
    </div>
  );
}
```

- 기본 period `7d`, 잘못된 값은 `7d`로 폴백.
- `StatCard`는 page 내부 로컬 컴포넌트 (tone: slate/success/danger/warn).

---

## 6. UI 컴포넌트 명세

### 6.1 기간 필터 (`search-logs-filters.tsx`)

- 3버튼 토글 (`default`/`outline` variant), 선택 시 `?period=` set + `page` 삭제 후 router.push.
- `useTransition`으로 pending 중 disabled.
- 우측 안내: "오늘은 집계 진행 중이라 제외됩니다 (어제 기준)".

### 6.2 리스트 (`search-logs-list-client.tsx`)

#### 데스크탑 테이블 (md:block)

| 헤더 | 셀 |
|:-|:-|
| 유입 키워드 | `r.query` (font-medium) |
| 유입일시 | `formatDateTimeKst(r.createdAt)` |
| 세션 체류 (우측정렬) | `formatDwell(r.dwellSeconds)` |
| 도움됨 (반응표) | `<Helpful tally={r.helpful} />` |
| 유출 채널 (페이지 URL) | `<Outflow row={r} />` |

#### 모바일 카드뷰 (md:hidden)

- 상단: query + 반응표
- 중단: 유입일시 · 체류시간
- 하단: 유출 라벨 + URL

#### `<Helpful>` (Q-2)

```tsx
function Helpful({ tally }: { tally: HelpfulTally | null }) {
  if (!tally) return <span>—</span>;
  if (tally.yes === 0 && tally.no === 0) return <span>반응 없음</span>;
  return (<span> <ThumbsUp/>{tally.yes} <ThumbsDown/>{tally.no} </span>);
}
```

#### `<Outflow>`

- `outflowLabel` 없음 → "— (이탈)"
- `outflowUrl` 없음 (label만) → 라벨 텍스트
- 둘 다 있음 → `<Link target="_blank">` + ExternalLink 아이콘 + URL truncate

#### `formatDwell` (초 → 사람이 읽는 단위)

```ts
function formatDwell(sec: number | null): string {
  if (sec == null) return '—';
  if (sec <= 0) return '0초';
  const h = Math.floor(sec/3600), m = Math.floor((sec%3600)/60), s = sec%60;
  if (h > 0) return `${h}시간 ${m}분`;
  if (m > 0) return `${m}분 ${s}초`;
  return `${s}초`;
}
```

#### 페이지네이션

- `lastPage = ceil(total / pageSize)`, `> 1`일 때만 렌더.
- 이전/다음 버튼(경계 disabled) + "현재-끝 / total" + "page / lastPage".

---

## 7. 사이드바 (Q-3) — `nav-items.ts`

```ts
export type TabGroup = 'tickets' | 'content' | 'insight' | 'org';   // 'insight' 추가

// NAV_ITEMS에 추가 (content와 org 사이)
{
  href: '/admin/insights/search-logs',
  label: '검색로그',
  icon: Search,
  roles: ['manager', 'admin'],
  group: 'insight',
},

export const GROUP_ORDER: TabGroup[] = ['tickets', 'content', 'insight', 'org'];
export const GROUP_LABEL: Record<TabGroup, string> = {
  tickets: '티켓 운영',
  content: '콘텐츠',
  insight: '인사이트',   // 신규
  org: '조직 & 마스터',
};
```

- `Search` 아이콘 import 추가.
- 기존 NavItem 항목/순서 무변경 (R2).

---

## 8. 권한 / 보안 매트릭스

| 리소스 | 호텔리어 | 매니저 | 어드민 |
|:-|:-:|:-:|:-:|
| `/admin/insights/search-logs` (조회) | ❌ | ✅ | ✅ |
| 검색로그 편집/삭제 | ❌ | ❌ | ❌ (기능 없음 — Q-4) |

- 페이지 진입 `requireRole(['manager','admin'])` (E1).
- 읽기 전용 — write/delete 경로 자체가 없음.

---

## 9. 시나리오 (E2E 후보)

| ID | 시나리오 | 기대 결과 |
|:-:|:-|:-|
| TC-01 | 매니저가 `/admin/insights/search-logs` 진입 | 5컬럼 테이블 + 4 StatCard 표시 (기본 7d) |
| TC-02 | "어제 (1일)" 버튼 클릭 | `?period=yesterday`, 어제 00:00~오늘 00:00 KST 데이터만 |
| TC-03 | 클릭해 아티클 도달한 검색 행 | 👍/👎 반응표 집계 + 유출 URL `/help/{product}/{slug}` 외부 링크 |
| TC-04 | 클릭 없이 이탈한 검색 행 | 도움됨 "—", 유출 "— (이탈)" |
| TC-05 | 검색 후 티켓 접수한 행 | 유출 라벨 "티켓 접수" + `/tickets/new` |
| TC-06 | 30일 데이터가 30건 초과 | 페이지네이션 노출, 2페이지 이동 정상 |
| TC-07 | 빈 기간 | EmptyState "이 기간에 검색 이력이 없습니다" |
| TC-08 | 호텔리어가 URL 직접 접근 | requireRole 차단 |

### 9.1 회귀

| ID | 시나리오 |
|:-:|:-|
| R-01 | `/admin/master/search-quality` 집계 대시보드 영향 0 |
| R-02 | 사이드바 기존 메뉴(티켓/콘텐츠/조직) 순서·렌더 정상, 인사이트 그룹이 콘텐츠와 조직 사이 노출 |

---

## 10. 빌드 / 의존 그래프

```
search-logs.ts (Service: listSearchLogs)
  ├─ db/schema/search-logs.ts (searchLogs)
  ├─ db/schema/articles.ts (helpfulYes/No, slug)
  └─ db/schema/faqs.ts (helpfulYes/No, id)
        ↑
page.tsx (RSC) ── requireRole, PageHeader, Card, EmptyState, StatCard(local)
   ├─ search-logs-filters.tsx (client)
   └─ search-logs-list-client.tsx (client) ── formatDateTimeKst, lucide(ThumbsUp/Down/ExternalLink/Chevron)

nav-items.ts (insight 그룹) ── AdminSidebar / AdminMobileHeader 공유
```

순환 의존 없음 ✅

---

## 11. 검증 자체평가 (Match 예상)

| 항목 | Plan 명세 | Design 반영 | 일치 |
|:-|:-|:-|:-:|
| Goals G1~G5 | 명시 | §1·§4·§5·§6·§7 | ✅ |
| Scope P0-A~J | 10개 | §4(서비스 A~F) + §5·§6(G~I) + §7(J) | ✅ |
| Scope P1-K~M | 3개 | P1-K(IMPL) §1.2 후속, P1-L(StatCard) §5, P1-M(외부링크) §6.2 | ✅ |
| 컬럼 5종 정의 | §5 | §6.2 테이블 매핑 | ✅ |
| Risk C1~C4/E1/E2/R1/R2 | 8개 | §3·§4.2·§4.3·§4.5·§8 | ✅ |
| Q-1~Q-4 결정 | §8 | §0·§3·§4.5·§7 | ✅ |

**예상 Match Rate**: 99%+

---

## 12. 다음 단계 (Do)

### 12.1 권장 구현 순서

1. `lib/services/search-logs.ts` — 타입 + `kstPeriodRange` + `buildOutflow` + `listSearchLogs`
2. `app/(admin)/admin/insights/search-logs/page.tsx` — RSC + StatCard
3. `_components/search-logs-filters.tsx`
4. `_components/search-logs-list-client.tsx`
5. `nav-items.ts` — 인사이트 그룹
6. `npx tsc --noEmit` 통과 확인
7. (P1) `IMPLEMENTATION_PLAN.md` 반영
