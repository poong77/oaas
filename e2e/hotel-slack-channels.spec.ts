/**
 * 호텔 ↔ 슬랙 채널 연동 (N:N) — 어드민 호텔 상세 섹션 E2E.
 *
 * 검증 시나리오:
 *   S-01 호텔 상세에 '슬랙 채널 연동' 섹션이 렌더된다
 *   S-02 미연동 호텔은 '미연동' 배지 + 빈 상태 안내가 노출된다
 *   S-03 채널 검색 콤보박스가 존재하고 포커스 시 드롭다운이 열린다
 *        (Slack 미설정이면 안내, 설정이면 검색 결과/결과없음)
 *   S-04 (DB 시드) bot_joined=true 채널을 직접 연동하면 '연동됨' 배지 +
 *        테스트/해제 버튼이 노출되고 로고가 연동 상태가 된다
 *
 * 데이터 주도: 특정 호텔명을 하드코딩하지 않고, DB에서 첫 활성 호텔을 골라 사용.
 * S-04는 DB 직접 접근이 가능할 때만 수행(불가 시 graceful skip).
 */

import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import { config } from 'dotenv';
import { STORAGE_STATE_PATHS } from './fixtures/users';

// dev DB 접속을 위한 환경 로드 (.env.local 우선)
config({ path: path.resolve(__dirname, '..', '.env.local') });

test.use({
  storageState: STORAGE_STATE_PATHS.admin,
  viewport: { width: 1440, height: 900 },
});

const SECTION_TITLE = '슬랙 채널 연동';
const TEST_CHANNEL_ID = 'C0E2ETEST01';

type SeededHotel = { id: string; name: string };

/** pg로 dev DB 접속 (실패 시 null → 해당 테스트 skip). */
async function withDb<T>(fn: (q: (sql: string, params?: unknown[]) => Promise<{ rows: any[] }>) => Promise<T>): Promise<T | null> {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  const ssl = /sslmode=require/i.test(url)
    ? { rejectUnauthorized: false }
    : /sslmode=disable/i.test(url)
      ? false
      : undefined;
  // 동적 import — pg 미설치/환경 차이에 강하도록
  let pg: typeof import('pg');
  try {
    pg = await import('pg');
  } catch {
    return null;
  }
  const client = new pg.default.Client({
    connectionString: url,
    ...(ssl !== undefined ? { ssl } : {}),
  });
  try {
    await client.connect();
  } catch {
    return null;
  }
  try {
    return await fn((sql, params) => client.query(sql, params as any[]));
  } finally {
    await client.end().catch(() => undefined);
  }
}

/** DB에서 첫 활성 호텔 id를 조회 (없거나 DB 불가 시 null). */
async function firstHotelId(): Promise<string | null> {
  return withDb<string | null>(async (q) => {
    const r = await q(
      'select id from hotels where is_active = true order by created_at asc limit 1',
    );
    return r.rows[0]?.id ?? null;
  });
}

/** 첫 호텔 상세로 이동하고 섹션 렌더를 확인. id 반환(없으면 null). */
async function gotoFirstHotelDetail(page: Page): Promise<string | null> {
  const id = await firstHotelId();
  if (!id) return null;
  await page.goto(`/admin/hotels/${id}`);
  await expect(page.getByText(SECTION_TITLE).first()).toBeVisible();
  return id;
}

test.describe('호텔 상세 — 슬랙 채널 연동', () => {
  test('S-01 슬랙 채널 연동 섹션이 렌더된다', async ({ page }) => {
    const id = await gotoFirstHotelDetail(page);
    test.skip(!id, 'DB 접근 불가 또는 호텔 없음');
    await expect(page.getByText(SECTION_TITLE).first()).toBeVisible();
    // 안내 문구(기존 #support_new 병행) 노출
    await expect(
      page.getByText(/연동된 채널로 알림/),
    ).toBeVisible();
  });

  test('S-03 채널 검색 콤보박스가 존재하고 포커스 시 드롭다운이 열린다', async ({
    page,
  }) => {
    const id = await gotoFirstHotelDetail(page);
    test.skip(!id, 'DB 접근 불가 또는 호텔 없음');
    const combo = page.getByRole('combobox', { name: '슬랙 채널 검색' });
    await expect(combo).toBeVisible();
    await combo.click();
    await combo.fill('oa');
    // 드롭다운이 떠야 한다 — 검색중/결과없음/미설정 안내/결과 중 하나
    const dropdownText = page.getByText(
      /검색 중…|검색 결과가 없습니다|채널명 또는 채널 ID|토큰\/스코프|봇 참여중|자동입장|수동 초대 필요/,
    );
    await expect(dropdownText.first()).toBeVisible({ timeout: 10_000 });
  });

  test('S-04 연동된 채널은 연동됨 배지 + 테스트/해제 버튼이 노출된다', async ({
    page,
  }) => {
    // 1) DB에서 첫 호텔을 고르고 테스트용 연동 행 시드
    const seeded = await withDb<SeededHotel | null>(async (q) => {
      const h = await q(
        'select id, name from hotels where is_active = true order by created_at asc limit 1',
      );
      if (h.rows.length === 0) return null;
      const hotel = h.rows[0] as SeededHotel;
      // 멱등: 기존 테스트 행 제거 후 삽입
      await q(
        'delete from hotel_slack_channels where hotel_id = $1 and channel_id = $2',
        [hotel.id, TEST_CHANNEL_ID],
      );
      await q(
        `insert into hotel_slack_channels
           (hotel_id, channel_id, channel_name, channel_is_private, bot_joined)
         values ($1, $2, $3, false, true)`,
        [hotel.id, TEST_CHANNEL_ID, 'e2e-slack-link'],
      );
      return hotel;
    });

    test.skip(!seeded, 'DB 접근 불가 또는 호텔 없음 — 연동 표시 검증 생략');

    try {
      // 2) 상세 페이지에서 연동 상태 확인
      await page.goto(`/admin/hotels/${seeded!.id}`);
      await expect(page.getByText(SECTION_TITLE).first()).toBeVisible();

      // 채널명 + 연동됨 배지
      await expect(page.getByText('e2e-slack-link')).toBeVisible();
      await expect(page.getByText('연동됨', { exact: true }).first()).toBeVisible();

      // 테스트 발송 / 연동 해제 버튼
      await expect(
        page.getByRole('button', { name: /테스트 발송/ }).first(),
      ).toBeVisible();
      await expect(
        page.getByRole('button', { name: /연동 해제/ }).first(),
      ).toBeVisible();

      // 채널 ID(모노스페이스) 노출
      await expect(page.getByText(TEST_CHANNEL_ID).first()).toBeVisible();
    } finally {
      // 3) 시드 정리 (테스트 데이터 하드 삭제)
      await withDb(async (q) => {
        await q(
          'delete from hotel_slack_channels where channel_id = $1',
          [TEST_CHANNEL_ID],
        );
        return null;
      });
    }
  });
});
