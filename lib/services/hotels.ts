/**
 * 호텔 상세(정보 보강) 서비스 계층.
 *
 * - 솔루션 링크(이용중 솔루션): 비밀번호는 절대 평문 반환하지 않음 (hasPassword 플래그만).
 * - 멀티관리 호텔: 양방향 매핑 조회.
 * - 매핑된 이용자 계정: users.hotel_id 기준.
 * - 솔루션 프리셋: 드롭다운 출처.
 */

import { and, asc, desc, eq } from 'drizzle-orm';

import { db } from '@/db';
import {
  hotelManagedLinks,
  hotelSlackChannels,
  hotelSolutionLinks,
  hotels,
  solutionLinkPresets,
  users,
} from '@/db/schema';

/** 솔루션 링크 — 클라이언트로 보낼 안전 형태 (비밀번호 평문 제외). */
export type HotelSolutionView = {
  id: string;
  presetId: string | null;
  label: string;
  url: string;
  loginId: string | null;
  hasPassword: boolean;
  sortOrder: number;
};

export async function listHotelSolutions(
  hotelId: string,
): Promise<HotelSolutionView[]> {
  if (!db) return [];
  try {
    const rows = await db
      .select({
        id: hotelSolutionLinks.id,
        presetId: hotelSolutionLinks.presetId,
        label: hotelSolutionLinks.label,
        url: hotelSolutionLinks.url,
        loginId: hotelSolutionLinks.loginId,
        passwordEnc: hotelSolutionLinks.passwordEnc,
        sortOrder: hotelSolutionLinks.sortOrder,
      })
      .from(hotelSolutionLinks)
      .where(
        and(
          eq(hotelSolutionLinks.hotelId, hotelId),
          eq(hotelSolutionLinks.isActive, true),
        ),
      )
      .orderBy(
        asc(hotelSolutionLinks.sortOrder),
        asc(hotelSolutionLinks.createdAt),
      );
    return rows.map((r) => ({
      id: r.id,
      presetId: r.presetId,
      label: r.label,
      url: r.url,
      loginId: r.loginId,
      hasPassword: Boolean(r.passwordEnc),
      sortOrder: r.sortOrder,
    }));
  } catch (err) {
    console.error('[hotels.listHotelSolutions] 실패:', err);
    return [];
  }
}

export type SolutionPresetOption = {
  id: string;
  label: string;
  defaultUrlTemplate: string | null;
};

export async function listSolutionPresets(): Promise<SolutionPresetOption[]> {
  if (!db) return [];
  try {
    const rows = await db
      .select({
        id: solutionLinkPresets.id,
        label: solutionLinkPresets.label,
        defaultUrlTemplate: solutionLinkPresets.defaultUrlTemplate,
        sortOrder: solutionLinkPresets.sortOrder,
      })
      .from(solutionLinkPresets)
      .where(eq(solutionLinkPresets.isActive, true))
      .orderBy(asc(solutionLinkPresets.sortOrder), asc(solutionLinkPresets.label));
    return rows.map((r) => ({
      id: r.id,
      label: r.label,
      defaultUrlTemplate: r.defaultUrlTemplate,
    }));
  } catch (err) {
    console.error('[hotels.listSolutionPresets] 실패:', err);
    return [];
  }
}

/** 호텔에 연동된 Slack 채널 (어드민 상세 표시용). */
export type HotelSlackChannelView = {
  id: string;
  channelId: string;
  channelName: string | null;
  channelIsPrivate: boolean;
  botJoined: boolean;
  notifyEnabled: boolean;
};

/** 호텔의 활성 연동 채널 목록 (생성순). */
export async function listHotelSlackChannels(
  hotelId: string,
): Promise<HotelSlackChannelView[]> {
  if (!db) return [];
  try {
    const rows = await db
      .select({
        id: hotelSlackChannels.id,
        channelId: hotelSlackChannels.channelId,
        channelName: hotelSlackChannels.channelName,
        channelIsPrivate: hotelSlackChannels.channelIsPrivate,
        botJoined: hotelSlackChannels.botJoined,
        notifyEnabled: hotelSlackChannels.notifyEnabled,
      })
      .from(hotelSlackChannels)
      .where(
        and(
          eq(hotelSlackChannels.hotelId, hotelId),
          eq(hotelSlackChannels.isActive, true),
        ),
      )
      .orderBy(asc(hotelSlackChannels.createdAt));
    return rows;
  } catch (err) {
    console.error('[hotels.listHotelSlackChannels] 실패:', err);
    return [];
  }
}

export type ManagedHotelView = {
  linkId: string;
  hotelId: string;
  name: string;
  isActive: boolean;
};

/** 멀티관리로 연결된 호텔 목록 (기준 호텔 기준 양방향 매핑의 상대편). */
export async function listManagedHotels(
  hotelId: string,
): Promise<ManagedHotelView[]> {
  if (!db) return [];
  try {
    const rows = await db
      .select({
        linkId: hotelManagedLinks.id,
        hotelId: hotels.id,
        name: hotels.name,
        isActive: hotels.isActive,
      })
      .from(hotelManagedLinks)
      .innerJoin(hotels, eq(hotelManagedLinks.linkedHotelId, hotels.id))
      .where(
        and(
          eq(hotelManagedLinks.hotelId, hotelId),
          eq(hotelManagedLinks.isActive, true),
        ),
      )
      .orderBy(asc(hotels.name));
    return rows;
  } catch (err) {
    console.error('[hotels.listManagedHotels] 실패:', err);
    return [];
  }
}

export type MappedUserView = {
  id: string;
  name: string;
  username: string | null;
  email: string | null;
  role: string;
  isActive: boolean;
};

/** 이 호텔에 매핑된 이용자 계정 목록. */
export async function listMappedUsers(
  hotelId: string,
): Promise<MappedUserView[]> {
  if (!db) return [];
  try {
    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        username: users.username,
        email: users.email,
        role: users.role,
        isActive: users.isActive,
      })
      .from(users)
      .where(eq(users.hotelId, hotelId))
      .orderBy(desc(users.isActive), asc(users.name));
    return rows;
  } catch (err) {
    console.error('[hotels.listMappedUsers] 실패:', err);
    return [];
  }
}
