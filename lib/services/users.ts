/**
 * users / hotels 데이터 액세스 (서버 전용).
 *
 * 모든 함수는 Server Component 또는 Server Action에서만 호출.
 * DB가 placeholder인 경우 빈 결과를 반환하여 빌드/UI가 깨지지 않도록 graceful.
 */

import 'server-only';
import { and, asc, desc, eq, ilike, or, sql, type SQL } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

import { db } from '@/db';
import { collapseSpacing } from '@/lib/text/normalize';
import {
  hotels,
  hotelSolutionLinks,
  users,
  type Hotel,
  type User,
  type UserRole,
} from '@/db/schema';

// ─────────────────────────────────────────────────────────────────────
// 공통 타입
// ─────────────────────────────────────────────────────────────────────

export type ListUsersParams = {
  q?: string;
  role?: UserRole;
  isActive?: boolean | 'all';
  hotelId?: string;
  sortBy?: 'created_at' | 'last_login_at' | 'name' | 'email';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
};

export type ListUsersResult = {
  items: Array<User & { hotelName: string | null }>;
  total: number;
  page: number;
  pageSize: number;
};

// ─────────────────────────────────────────────────────────────────────
// 사용자
// ─────────────────────────────────────────────────────────────────────

export async function listUsers(
  params: ListUsersParams = {},
): Promise<ListUsersResult> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(5, params.pageSize ?? 20));
  const offset = (page - 1) * pageSize;

  if (!db) {
    return { items: [], total: 0, page, pageSize };
  }

  const conditions: SQL[] = [];
  // isActive 기본: true. 'all' 이면 조건 없음.
  if (params.isActive !== 'all') {
    conditions.push(eq(users.isActive, params.isActive ?? true));
  }
  if (params.role) {
    conditions.push(eq(users.role, params.role));
  }
  if (params.hotelId) {
    conditions.push(eq(users.hotelId, params.hotelId));
  }
  if (params.q && params.q.trim()) {
    const pattern = `%${params.q.trim()}%`;
    const search = or(
      ilike(users.email, pattern),
      ilike(users.name, pattern),
      ilike(users.phone, pattern),
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
    params.sortBy === 'last_login_at'
      ? users.lastLoginAt
      : params.sortBy === 'name'
        ? users.name
        : params.sortBy === 'email'
          ? users.email
          : users.createdAt;
  const orderExpr =
    (params.sortOrder ?? 'desc') === 'asc'
      ? asc(sortColumn)
      : desc(sortColumn);

  try {
    const rows = await db
      .select({
        user: users,
        hotelName: hotels.name,
      })
      .from(users)
      .leftJoin(hotels, eq(users.hotelId, hotels.id))
      .where(whereExpr)
      .orderBy(orderExpr)
      .limit(pageSize)
      .offset(offset);

    const totalRows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(whereExpr);
    const total = Number(totalRows[0]?.count ?? 0);

    return {
      items: rows.map((r) => ({ ...r.user, hotelName: r.hotelName })),
      total,
      page,
      pageSize,
    };
  } catch (err) {
    console.error('[users.listUsers] 실패:', err);
    return { items: [], total: 0, page, pageSize };
  }
}

export async function getUserById(
  id: string,
): Promise<(User & { hotelName: string | null }) | null> {
  if (!db) return null;
  try {
    const rows = await db
      .select({ user: users, hotelName: hotels.name })
      .from(users)
      .leftJoin(hotels, eq(users.hotelId, hotels.id))
      .where(eq(users.id, id))
      .limit(1);
    const r = rows[0];
    return r ? { ...r.user, hotelName: r.hotelName } : null;
  } catch (err) {
    console.error('[users.getUserById] 실패:', err);
    return null;
  }
}

export async function listStaffByHotel(hotelId: string) {
  if (!db) return [];
  try {
    return await db
      .select()
      .from(users)
      .where(eq(users.hotelId, hotelId))
      .orderBy(desc(users.isActive), desc(users.createdAt));
  } catch (err) {
    console.error('[users.listStaffByHotel] 실패:', err);
    return [];
  }
}

export async function emailExists(
  email: string,
  excludeId?: string,
): Promise<boolean> {
  if (!db) return false;
  try {
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (rows.length === 0) return false;
    if (excludeId && rows[0]!.id === excludeId) return false;
    return true;
  } catch (err) {
    console.error('[users.emailExists] 실패:', err);
    return false;
  }
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** 임시 비밀번호 생성 (영문 대소문자+숫자+특수문자 1개). 길이 10. */
export function generateTempPassword(length = 10): string {
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  const symbols = '!@#$%';
  const all = lower + upper + digits + symbols;
  const pick = (set: string) =>
    set[Math.floor(Math.random() * set.length)] ?? 'a';
  // 각 카테고리에서 1자씩 + 나머지 랜덤
  const base = [pick(lower), pick(upper), pick(digits), pick(symbols)];
  for (let i = base.length; i < length; i++) base.push(pick(all));
  // shuffle
  for (let i = base.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [base[i], base[j]] = [base[j]!, base[i]!];
  }
  return base.join('');
}

// ─────────────────────────────────────────────────────────────────────
// 호텔
// ─────────────────────────────────────────────────────────────────────

export type ListHotelsParams = {
  q?: string;
  isActive?: boolean | 'all';
  page?: number;
  pageSize?: number;
  sortBy?: 'created_at' | 'name';
  sortOrder?: 'asc' | 'desc';
};

export async function listHotels(params: ListHotelsParams = {}): Promise<{
  items: Hotel[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(5, params.pageSize ?? 20));
  const offset = (page - 1) * pageSize;

  if (!db) {
    return { items: [], total: 0, page, pageSize };
  }

  const conditions: SQL[] = [];
  if (params.isActive !== 'all') {
    conditions.push(eq(hotels.isActive, params.isActive ?? true));
  }
  if (params.q && params.q.trim()) {
    const raw = params.q.trim();
    const pattern = `%${raw}%`;
    // 업체명은 띄어쓰기·하이픈·점을 무시하고 매칭 ("더페이즈" → "더 페이즈 호텔")
    const collapsed = collapseSpacing(raw);
    const nameMatch =
      collapsed.length > 0
        ? sql`translate(lower(${hotels.name}), ' -_.·', '') LIKE ${`%${collapsed}%`}`
        : ilike(hotels.name, pattern);
    const search = or(
      nameMatch,
      ilike(hotels.oaPmsHotelId, pattern),
      ilike(hotels.managerName, pattern),
    );
    if (search) conditions.push(search);
  }

  const whereExpr =
    conditions.length === 0
      ? undefined
      : conditions.length === 1
        ? conditions[0]
        : and(...conditions);

  const sortColumn = params.sortBy === 'name' ? hotels.name : hotels.createdAt;
  const orderExpr =
    (params.sortOrder ?? 'desc') === 'asc'
      ? asc(sortColumn)
      : desc(sortColumn);

  try {
    const items = await db
      .select()
      .from(hotels)
      .where(whereExpr)
      .orderBy(orderExpr)
      .limit(pageSize)
      .offset(offset);
    const totalRows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(hotels)
      .where(whereExpr);
    return {
      items,
      total: Number(totalRows[0]?.count ?? 0),
      page,
      pageSize,
    };
  } catch (err) {
    console.error('[users.listHotels] 실패:', err);
    return { items: [], total: 0, page, pageSize };
  }
}

export async function getHotelById(id: string): Promise<Hotel | null> {
  if (!db) return null;
  try {
    const rows = await db
      .select()
      .from(hotels)
      .where(eq(hotels.id, id))
      .limit(1);
    return rows[0] ?? null;
  } catch (err) {
    console.error('[users.getHotelById] 실패:', err);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────
// 솔루션 링크 (AC-02)
// ─────────────────────────────────────────────────────────────────────

export const MAX_SOLUTION_LINKS_PER_HOTEL = 5;

export async function listSolutionLinksByHotel(hotelId: string) {
  if (!db) return [];
  try {
    return await db
      .select()
      .from(hotelSolutionLinks)
      .where(
        and(
          eq(hotelSolutionLinks.hotelId, hotelId),
          eq(hotelSolutionLinks.isActive, true),
        ),
      )
      .orderBy(asc(hotelSolutionLinks.sortOrder), asc(hotelSolutionLinks.createdAt));
  } catch (err) {
    console.error('[users.listSolutionLinksByHotel] 실패:', err);
    return [];
  }
}
