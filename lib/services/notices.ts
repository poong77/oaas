/**
 * notices 데이터 액세스 (Server 전용) — Phase 7 NT-01.
 *
 * 운영 패턴 (notices.ts 스키마 주석 참조):
 *   - listNotices: pinned DESC, published_at DESC 기본 정렬
 *   - listActiveBannerNotices: emergency-banner.tsx에서 사용
 *   - listRecentPublishedNotices + listPinnedPublishedNotices: 홈 위젯 통합 정렬용
 *   - searchNotices: ILIKE 기반 (title + body_markdown)
 *   - incrementNoticeViewCount: fire-and-forget
 *
 * 어드민 CRUD: createNotice / updateNoticeById / togglePublishNoticeById /
 *             archiveNoticeById / restoreNoticeById
 */

import 'server-only';
import {
  and,
  asc,
  desc,
  eq,
  gt,
  ilike,
  isNotNull,
  isNull,
  ne,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';

import { db } from '@/db';
import {
  notices,
  users,
  type Notice,
  type NewNotice,
  type NoticeKind,
  type NoticePopupSize,
} from '@/db/schema';

// ─────────────────────────────────────────────────────────────────────
// 타입
// ─────────────────────────────────────────────────────────────────────

export type NoticeListItem = Pick<
  Notice,
  | 'id'
  | 'kind'
  | 'productCode'
  | 'title'
  | 'bodyMarkdown'
  | 'pinned'
  | 'banner'
  | 'bannerUntil'
  | 'publishedAt'
  | 'viewCount'
  | 'isActive'
  | 'createdAt'
  | 'updatedAt'
  | 'authorId'
>;

export type NoticeDetail = Notice & {
  authorName: string | null;
  authorEmail: string | null;
};

export type ListNoticesParams = {
  kind?: NoticeKind;
  productCode?: string;
  q?: string;
  isActive?: boolean | 'all';
  /** true: 발행만, false: draft만, undefined: 모두 */
  publishedOnly?: boolean;
  sortBy?: 'published_at' | 'view_count' | 'updated_at' | 'created_at';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
};

export type ListNoticesResult = {
  items: NoticeListItem[];
  total: number;
  page: number;
  pageSize: number;
};

// ─────────────────────────────────────────────────────────────────────
// 조회 — 호텔리어 목록 / 어드민 리스트 공용
// ─────────────────────────────────────────────────────────────────────

export async function listNotices(
  params: ListNoticesParams = {},
): Promise<ListNoticesResult> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(5, params.pageSize ?? 10));
  const offset = (page - 1) * pageSize;

  if (!db) {
    return { items: [], total: 0, page, pageSize };
  }

  const conditions: SQL[] = [];
  if (params.isActive !== 'all') {
    conditions.push(eq(notices.isActive, params.isActive ?? true));
  }
  if (params.kind) {
    conditions.push(eq(notices.kind, params.kind));
  }
  if (params.productCode) {
    conditions.push(eq(notices.productCode, params.productCode));
  }
  if (params.publishedOnly === true) {
    conditions.push(isNotNull(notices.publishedAt));
  } else if (params.publishedOnly === false) {
    conditions.push(isNull(notices.publishedAt));
  }
  if (params.q && params.q.trim()) {
    const pattern = `%${params.q.trim()}%`;
    const search = or(
      ilike(notices.title, pattern),
      ilike(notices.bodyMarkdown, pattern),
    );
    if (search) conditions.push(search);
  }

  const whereExpr =
    conditions.length === 0
      ? undefined
      : conditions.length === 1
        ? conditions[0]
        : and(...conditions);

  const sortColumn =
    params.sortBy === 'view_count'
      ? notices.viewCount
      : params.sortBy === 'updated_at'
        ? notices.updatedAt
        : params.sortBy === 'created_at'
          ? notices.createdAt
          : notices.publishedAt;
  const orderDir = (params.sortOrder ?? 'desc') === 'asc' ? 'asc' : 'desc';
  // published_at 정렬 시 draft(NULL)는 항상 맨 아래로 (NULLS LAST).
  // desc 기본은 Postgres가 NULLS FIRST라 draft가 상단에 뜨는 문제 방지.
  const orderExpr =
    sortColumn === notices.publishedAt
      ? sql`${notices.publishedAt} ${sql.raw(orderDir)} nulls last`
      : orderDir === 'asc'
        ? asc(sortColumn)
        : desc(sortColumn);

  try {
    // 핀 상단 → 정렬 컬럼 → fallback created_at
    const items = await db
      .select({
        id: notices.id,
        kind: notices.kind,
        productCode: notices.productCode,
        title: notices.title,
        bodyMarkdown: notices.bodyMarkdown,
        pinned: notices.pinned,
        banner: notices.banner,
        bannerUntil: notices.bannerUntil,
        publishedAt: notices.publishedAt,
        viewCount: notices.viewCount,
        isActive: notices.isActive,
        createdAt: notices.createdAt,
        updatedAt: notices.updatedAt,
        authorId: notices.authorId,
      })
      .from(notices)
      .where(whereExpr)
      .orderBy(desc(notices.pinned), orderExpr, desc(notices.createdAt))
      .limit(pageSize)
      .offset(offset);

    const totalRows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notices)
      .where(whereExpr);
    const total = Number(totalRows[0]?.count ?? 0);

    return { items, total, page, pageSize };
  } catch (err) {
    console.error('[notices.listNotices] 실패:', err);
    return { items: [], total: 0, page, pageSize };
  }
}

/**
 * 현재 필터 조건의 "전체" 상태별 카운트 (페이지 무관) — 어드민 통계 카드용.
 * listNotices와 동일한 where 조건(페이징/정렬 제외)을 적용한다.
 */
export type NoticeStatusCounts = {
  total: number;
  published: number;
  draft: number;
};

export async function getNoticeCounts(
  params: Pick<
    ListNoticesParams,
    'kind' | 'productCode' | 'q' | 'isActive' | 'publishedOnly'
  > = {},
): Promise<NoticeStatusCounts> {
  if (!db) return { total: 0, published: 0, draft: 0 };

  const conditions: SQL[] = [];
  if (params.isActive !== 'all') {
    conditions.push(eq(notices.isActive, params.isActive ?? true));
  }
  if (params.kind) {
    conditions.push(eq(notices.kind, params.kind));
  }
  if (params.productCode) {
    conditions.push(eq(notices.productCode, params.productCode));
  }
  if (params.publishedOnly === true) {
    conditions.push(isNotNull(notices.publishedAt));
  } else if (params.publishedOnly === false) {
    conditions.push(isNull(notices.publishedAt));
  }
  if (params.q && params.q.trim()) {
    const pattern = `%${params.q.trim()}%`;
    const search = or(
      ilike(notices.title, pattern),
      ilike(notices.bodyMarkdown, pattern),
    );
    if (search) conditions.push(search);
  }

  const whereExpr =
    conditions.length === 0
      ? undefined
      : conditions.length === 1
        ? conditions[0]
        : and(...conditions);

  try {
    const rows = await db
      .select({
        total: sql<number>`count(*)::int`,
        published: sql<number>`count(*) filter (where ${notices.publishedAt} is not null)::int`,
        draft: sql<number>`count(*) filter (where ${notices.publishedAt} is null)::int`,
      })
      .from(notices)
      .where(whereExpr);
    const r = rows[0];
    return {
      total: Number(r?.total ?? 0),
      published: Number(r?.published ?? 0),
      draft: Number(r?.draft ?? 0),
    };
  } catch (err) {
    console.error('[notices.getNoticeCounts] 실패:', err);
    return { total: 0, published: 0, draft: 0 };
  }
}

/**
 * id 기준 상세 조회.
 * - includeUnpublished: 매니저+어드민 미리보기용. 기본 false.
 */
export async function getNoticeById(
  id: string,
  options: { includeUnpublished?: boolean; includeInactive?: boolean } = {},
): Promise<NoticeDetail | null> {
  if (!db) return null;
  try {
    const conditions: SQL[] = [eq(notices.id, id)];
    if (!options.includeInactive) {
      conditions.push(eq(notices.isActive, true));
    }
    if (!options.includeUnpublished) {
      conditions.push(isNotNull(notices.publishedAt));
    }
    const rows = await db
      .select({
        notice: notices,
        authorName: users.name,
        authorEmail: users.email,
      })
      .from(notices)
      .leftJoin(users, eq(notices.authorId, users.id))
      .where(and(...conditions))
      .limit(1);
    const r = rows[0];
    return r
      ? {
          ...r.notice,
          authorName: r.authorName,
          authorEmail: r.authorEmail,
        }
      : null;
  } catch (err) {
    console.error('[notices.getNoticeById] 실패:', err);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────
// 위젯 / 배너용 헬퍼
// ─────────────────────────────────────────────────────────────────────

/**
 * 활성 banner notice 목록 (emergency-banner.tsx에서 사용).
 *
 * 조건:
 *   - is_active = true
 *   - banner = true
 *   - published_at IS NOT NULL
 *   - banner_until IS NULL OR banner_until > now()
 */
export async function listActiveBannerNotices(): Promise<NoticeListItem[]> {
  if (!db) return [];
  try {
    const now = new Date();
    const rows = await db
      .select({
        id: notices.id,
        kind: notices.kind,
        productCode: notices.productCode,
        title: notices.title,
        bodyMarkdown: notices.bodyMarkdown,
        pinned: notices.pinned,
        banner: notices.banner,
        bannerUntil: notices.bannerUntil,
        publishedAt: notices.publishedAt,
        viewCount: notices.viewCount,
        isActive: notices.isActive,
        createdAt: notices.createdAt,
        updatedAt: notices.updatedAt,
        authorId: notices.authorId,
      })
      .from(notices)
      .where(
        and(
          eq(notices.isActive, true),
          eq(notices.banner, true),
          isNotNull(notices.publishedAt),
          or(isNull(notices.bannerUntil), gt(notices.bannerUntil, now)),
        ),
      )
      .orderBy(desc(notices.publishedAt))
      .limit(5);
    return rows;
  } catch (err) {
    console.error('[notices.listActiveBannerNotices] 실패:', err);
    return [];
  }
}

/**
 * 활성 홈 팝업 배너 공지 목록 (home-popup-banner.tsx에서 사용) — NT-04.
 *
 * 조건:
 *   - is_active = true
 *   - popup_enabled = true
 *   - published_at IS NOT NULL
 *   - popup_image_url IS NOT NULL (이미지 없으면 노출 불가)
 *   - popup_until IS NULL OR popup_until > now()
 */
export type PopupNoticeItem = {
  id: string;
  kind: NoticeKind;
  title: string;
  popupImageUrl: string;
  popupSize: NoticePopupSize;
  /** CLS 방지용 원본 px 치수. 레거시 행은 null */
  popupImageWidth: number | null;
  popupImageHeight: number | null;
};

export async function listActivePopupNotices(): Promise<PopupNoticeItem[]> {
  if (!db) return [];
  try {
    const now = new Date();
    const rows = await db
      .select({
        id: notices.id,
        kind: notices.kind,
        title: notices.title,
        popupImageUrl: notices.popupImageUrl,
        popupSize: notices.popupSize,
        popupImageWidth: notices.popupImageWidth,
        popupImageHeight: notices.popupImageHeight,
      })
      .from(notices)
      .where(
        and(
          eq(notices.isActive, true),
          eq(notices.popupEnabled, true),
          isNotNull(notices.publishedAt),
          isNotNull(notices.popupImageUrl),
          or(isNull(notices.popupUntil), gt(notices.popupUntil, now)),
        ),
      )
      .orderBy(desc(notices.publishedAt))
      .limit(5);
    // popupImageUrl IS NOT NULL 조건으로 걸렀으므로 non-null 단언 안전
    return rows
      .filter((r): r is typeof r & { popupImageUrl: string } =>
        Boolean(r.popupImageUrl),
      )
      .map((r) => ({
        id: r.id,
        kind: r.kind,
        title: r.title,
        popupImageUrl: r.popupImageUrl,
        popupSize: r.popupSize,
        popupImageWidth: r.popupImageWidth,
        popupImageHeight: r.popupImageHeight,
      }));
  } catch (err) {
    console.error('[notices.listActivePopupNotices] 실패:', err);
    return [];
  }
}

/** 핀고정 발행 공지 (홈 위젯 상단용). */
export async function listPinnedPublishedNotices(
  limit = 1,
): Promise<NoticeListItem[]> {
  if (!db) return [];
  try {
    return await db
      .select({
        id: notices.id,
        kind: notices.kind,
        productCode: notices.productCode,
        title: notices.title,
        bodyMarkdown: notices.bodyMarkdown,
        pinned: notices.pinned,
        banner: notices.banner,
        bannerUntil: notices.bannerUntil,
        publishedAt: notices.publishedAt,
        viewCount: notices.viewCount,
        isActive: notices.isActive,
        createdAt: notices.createdAt,
        updatedAt: notices.updatedAt,
        authorId: notices.authorId,
      })
      .from(notices)
      .where(
        and(
          eq(notices.isActive, true),
          eq(notices.pinned, true),
          isNotNull(notices.publishedAt),
        ),
      )
      .orderBy(desc(notices.publishedAt))
      .limit(limit);
  } catch (err) {
    console.error('[notices.listPinnedPublishedNotices] 실패:', err);
    return [];
  }
}

/** 최근 발행 공지 (홈 위젯용). */
export async function listRecentPublishedNotices(
  limit = 2,
): Promise<NoticeListItem[]> {
  if (!db) return [];
  try {
    return await db
      .select({
        id: notices.id,
        kind: notices.kind,
        productCode: notices.productCode,
        title: notices.title,
        bodyMarkdown: notices.bodyMarkdown,
        pinned: notices.pinned,
        banner: notices.banner,
        bannerUntil: notices.bannerUntil,
        publishedAt: notices.publishedAt,
        viewCount: notices.viewCount,
        isActive: notices.isActive,
        createdAt: notices.createdAt,
        updatedAt: notices.updatedAt,
        authorId: notices.authorId,
      })
      .from(notices)
      .where(and(eq(notices.isActive, true), isNotNull(notices.publishedAt)))
      .orderBy(desc(notices.publishedAt))
      .limit(limit);
  } catch (err) {
    console.error('[notices.listRecentPublishedNotices] 실패:', err);
    return [];
  }
}

/** 관련 공지 (같은 product 또는 같은 kind, 자신 제외). */
export async function listRelatedNotices(
  noticeId: string,
  productCode: string | null,
  kind: NoticeKind,
  limit = 3,
): Promise<NoticeListItem[]> {
  if (!db) return [];
  try {
    // 1) 같은 product의 발행분 우선 (productCode가 있을 때)
    if (productCode) {
      const byProduct = await db
        .select({
          id: notices.id,
          kind: notices.kind,
          productCode: notices.productCode,
          title: notices.title,
          bodyMarkdown: notices.bodyMarkdown,
          pinned: notices.pinned,
          banner: notices.banner,
          bannerUntil: notices.bannerUntil,
          publishedAt: notices.publishedAt,
          viewCount: notices.viewCount,
          isActive: notices.isActive,
          createdAt: notices.createdAt,
          updatedAt: notices.updatedAt,
          authorId: notices.authorId,
        })
        .from(notices)
        .where(
          and(
            eq(notices.isActive, true),
            isNotNull(notices.publishedAt),
            eq(notices.productCode, productCode),
            ne(notices.id, noticeId),
          ),
        )
        .orderBy(desc(notices.publishedAt))
        .limit(limit);
      if (byProduct.length >= limit) return byProduct;

      // 부족하면 같은 kind로 보충
      const need = limit - byProduct.length;
      const byKind = await db
        .select({
          id: notices.id,
          kind: notices.kind,
          productCode: notices.productCode,
          title: notices.title,
          bodyMarkdown: notices.bodyMarkdown,
          pinned: notices.pinned,
          banner: notices.banner,
          bannerUntil: notices.bannerUntil,
          publishedAt: notices.publishedAt,
          viewCount: notices.viewCount,
          isActive: notices.isActive,
          createdAt: notices.createdAt,
          updatedAt: notices.updatedAt,
          authorId: notices.authorId,
        })
        .from(notices)
        .where(
          and(
            eq(notices.isActive, true),
            isNotNull(notices.publishedAt),
            eq(notices.kind, kind),
            ne(notices.id, noticeId),
          ),
        )
        .orderBy(desc(notices.publishedAt))
        .limit(need + byProduct.length);

      // 중복 제거
      const existingIds = new Set(byProduct.map((n) => n.id));
      const merged = [
        ...byProduct,
        ...byKind.filter((n) => !existingIds.has(n.id)),
      ];
      return merged.slice(0, limit);
    }

    // 2) productCode 없으면 같은 kind만
    return await db
      .select({
        id: notices.id,
        kind: notices.kind,
        productCode: notices.productCode,
        title: notices.title,
        bodyMarkdown: notices.bodyMarkdown,
        pinned: notices.pinned,
        banner: notices.banner,
        bannerUntil: notices.bannerUntil,
        publishedAt: notices.publishedAt,
        viewCount: notices.viewCount,
        isActive: notices.isActive,
        createdAt: notices.createdAt,
        updatedAt: notices.updatedAt,
        authorId: notices.authorId,
      })
      .from(notices)
      .where(
        and(
          eq(notices.isActive, true),
          isNotNull(notices.publishedAt),
          eq(notices.kind, kind),
          ne(notices.id, noticeId),
        ),
      )
      .orderBy(desc(notices.publishedAt))
      .limit(limit);
  } catch (err) {
    console.error('[notices.listRelatedNotices] 실패:', err);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────
// 검색 (SS-01 — search 페이지 공지 탭)
// ─────────────────────────────────────────────────────────────────────

export type SearchNoticeHit = NoticeListItem & {
  /** 관련도 점수 — 동의어 확장 term 기준. */
  score: number;
  /** 제목이 검색어(동의어 포함)와 일치하는지 — "제목 일치" 뱃지용. */
  titleMatch: boolean;
};

export async function searchNotices(
  q: string,
  options: { productCode?: string; limit?: number } = {},
): Promise<SearchNoticeHit[]> {
  if (!db) return [];
  const query = q.trim();
  if (!query) return [];
  const limit = Math.min(100, Math.max(1, options.limit ?? 50));
  try {
    // v1.6 — articles/faqs와 동일하게 동의어 확장 적용.
    const { expandKeywords } = await import('./synonym-expander');
    const expanded = await expandKeywords(query, { maxTokens: 32 });
    const terms = expanded.length > 0 ? expanded : [query];

    const conditions: SQL[] = [
      eq(notices.isActive, true),
      isNotNull(notices.publishedAt),
    ];
    if (options.productCode) {
      conditions.push(eq(notices.productCode, options.productCode));
    }
    const orParts: SQL[] = [];
    for (const term of terms) {
      const p = `%${term}%`;
      const c = or(ilike(notices.title, p), ilike(notices.bodyMarkdown, p));
      if (c) orParts.push(c);
    }
    const searchCond =
      orParts.length === 0
        ? undefined
        : orParts.length === 1
          ? orParts[0]
          : or(...orParts);
    if (searchCond) conditions.push(searchCond);

    const rows = await db
      .select({
        id: notices.id,
        kind: notices.kind,
        productCode: notices.productCode,
        title: notices.title,
        bodyMarkdown: notices.bodyMarkdown,
        pinned: notices.pinned,
        banner: notices.banner,
        bannerUntil: notices.bannerUntil,
        publishedAt: notices.publishedAt,
        viewCount: notices.viewCount,
        isActive: notices.isActive,
        createdAt: notices.createdAt,
        updatedAt: notices.updatedAt,
        authorId: notices.authorId,
      })
      .from(notices)
      .where(and(...conditions))
      .orderBy(desc(notices.pinned), desc(notices.publishedAt))
      .limit(limit);

    const { matchesAnyTerm } = await import('@/lib/text/search-match');
    const lowered = query.toLowerCase();
    return rows.map((r) => {
      let score = 0.5;
      const titleMatch = matchesAnyTerm(r.title, terms);
      if (titleMatch) score += 2.5;
      if (matchesAnyTerm(r.bodyMarkdown, terms)) score += 1;
      // 원본 검색어가 제목에 그대로 있으면 가산(직접 일치 우대).
      if (r.title.toLowerCase().includes(lowered)) score += 1;
      return { ...r, score, titleMatch };
    });
  } catch (err) {
    console.error('[notices.searchNotices] 실패:', err);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────
// 카운터
// ─────────────────────────────────────────────────────────────────────

/** 페이지 진입 시 fire-and-forget 호출. 실패해도 무시. */
export function incrementNoticeViewCount(noticeId: string): void {
  if (!db) return;
  Promise.resolve()
    .then(async () => {
      await db!
        .update(notices)
        .set({ viewCount: sql`${notices.viewCount} + 1` })
        .where(eq(notices.id, noticeId));
    })
    .catch((err) => {
      console.warn(
        `[notices.incrementNoticeViewCount] noticeId=${noticeId} 실패:`,
        err instanceof Error ? err.message : err,
      );
    });
}

// ─────────────────────────────────────────────────────────────────────
// 어드민 CRUD (Server Action에서 호출)
// ─────────────────────────────────────────────────────────────────────

export type NoticeWriteInput = {
  kind: NoticeKind;
  /** null이면 전체 공지 */
  productCode?: string | null;
  title: string;
  bodyMarkdown: string;
  pinned?: boolean;
  banner?: boolean;
  bannerUntil?: Date | null;
  /** NT-04 홈 팝업 배너 */
  popupEnabled?: boolean;
  popupImageUrl?: string | null;
  popupImageWidth?: number | null;
  popupImageHeight?: number | null;
  popupSize?: NoticePopupSize;
  popupUntil?: Date | null;
  publish?: boolean;
};

export async function createNotice(
  input: NoticeWriteInput,
  authorId: string,
): Promise<{ ok: boolean; id?: string; message?: string }> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  try {
    const values: NewNotice = {
      kind: input.kind,
      productCode: input.productCode ?? null,
      title: input.title,
      bodyMarkdown: input.bodyMarkdown,
      pinned: input.pinned ?? false,
      banner: input.banner ?? false,
      bannerUntil: input.bannerUntil ?? null,
      popupEnabled: input.popupEnabled ?? false,
      popupImageUrl: input.popupImageUrl ?? null,
      popupImageWidth: input.popupImageWidth ?? null,
      popupImageHeight: input.popupImageHeight ?? null,
      popupSize: input.popupSize ?? 'medium',
      popupUntil: input.popupUntil ?? null,
      authorId,
      publishedAt: input.publish ? new Date() : null,
    };
    const [row] = await db.insert(notices).values(values).returning({
      id: notices.id,
    });
    return { ok: true, id: row?.id };
  } catch (err) {
    console.error('[notices.createNotice] 실패:', err);
    const msg = err instanceof Error ? err.message : 'INTERNAL_ERROR';
    return { ok: false, message: msg };
  }
}

export async function updateNoticeById(
  id: string,
  input: NoticeWriteInput,
): Promise<{ ok: boolean; message?: string }> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  try {
    await db
      .update(notices)
      .set({
        kind: input.kind,
        productCode: input.productCode ?? null,
        title: input.title,
        bodyMarkdown: input.bodyMarkdown,
        pinned: input.pinned ?? false,
        banner: input.banner ?? false,
        bannerUntil: input.bannerUntil ?? null,
        popupEnabled: input.popupEnabled ?? false,
        popupImageUrl: input.popupImageUrl ?? null,
        popupImageWidth: input.popupImageWidth ?? null,
        popupImageHeight: input.popupImageHeight ?? null,
        popupSize: input.popupSize ?? 'medium',
        popupUntil: input.popupUntil ?? null,
      })
      .where(eq(notices.id, id));
    return { ok: true };
  } catch (err) {
    console.error('[notices.updateNoticeById] 실패:', err);
    const msg = err instanceof Error ? err.message : 'INTERNAL_ERROR';
    return { ok: false, message: msg };
  }
}

export async function togglePublishNoticeById(
  id: string,
  publish: boolean,
): Promise<{ ok: boolean; message?: string }> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  try {
    await db
      .update(notices)
      .set({ publishedAt: publish ? new Date() : null })
      .where(eq(notices.id, id));
    return { ok: true };
  } catch (err) {
    console.error('[notices.togglePublishNoticeById] 실패:', err);
    return { ok: false, message: 'INTERNAL_ERROR' };
  }
}

export async function archiveNoticeById(
  id: string,
): Promise<{ ok: boolean; message?: string }> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  try {
    await db.update(notices).set({ isActive: false }).where(eq(notices.id, id));
    return { ok: true };
  } catch (err) {
    console.error('[notices.archiveNoticeById] 실패:', err);
    return { ok: false, message: 'INTERNAL_ERROR' };
  }
}

export async function restoreNoticeById(
  id: string,
): Promise<{ ok: boolean; message?: string }> {
  if (!db) return { ok: false, message: 'DB_NOT_READY' };
  try {
    await db.update(notices).set({ isActive: true }).where(eq(notices.id, id));
    return { ok: true };
  } catch (err) {
    console.error('[notices.restoreNoticeById] 실패:', err);
    return { ok: false, message: 'INTERNAL_ERROR' };
  }
}

// ─────────────────────────────────────────────────────────────────────
// UI 헬퍼 (server/client 공용 — 단순 매핑이므로 여기 둬도 무방)
// ─────────────────────────────────────────────────────────────────────

/** notices 목록·카드용 요약 추출 — body_markdown 첫 텍스트 줄, 헤딩/리스트 마커 제거. */
export function summarizeNoticeBody(body: string, maxLen = 80): string {
  const lines = body
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  for (const raw of lines) {
    // 코드블록 / 헤딩 마크 제거
    if (raw.startsWith('```')) continue;
    const cleaned = raw
      .replace(/^#{1,6}\s+/, '')
      .replace(/^[-*+]\s+/, '')
      .replace(/^\d+\.\s+/, '')
      .replace(/^>\s+/, '')
      .replace(/[*_`~]/g, '')
      .trim();
    if (cleaned.length === 0) continue;
    if (cleaned.length <= maxLen) return cleaned;
    return cleaned.slice(0, maxLen).trimEnd() + '...';
  }
  return '';
}
