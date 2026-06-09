/**
 * AC-11 셀프 비밀번호 찾기 — E2E.
 *
 * ⚠️ 안전 정책 (중요):
 *   로컬 .env.local 의 DATABASE_URL 은 실제 데이터(oaas_prd)를 가리키고
 *   SES/SOLAPI 키가 라이브일 수 있다. 따라서 기본 실행에서는
 *   **읽기 전용 + 가드 시나리오만** 수행한다 (발송/비번변경 없음).
 *
 *   전체 해피패스(코드 발송→검증→비번변경)는 실제 메일/문자 발송과
 *   실제 비밀번호 변경을 유발하므로, 격리 DB + 발송 스텁 환경에서만
 *   E2E_PWRESET_LIVE=1 로 명시적으로 실행한다.
 *
 * 데이터 주도: 시드/마이그레이션 DB 차이에 강하도록, 공개 검색 API로
 * 실제 호텔/계정을 먼저 찾아 그 데이터로 UI를 구동한다.
 */

import { test, expect, type APIRequestContext } from '@playwright/test';
import { STORAGE_STATE_PATHS } from './fixtures/users';

const SEARCH_TERMS = [
  '호텔', '리조트', '스테이', '관광', '파크', '인', '게스트',
  '펜션', '텔', '하우스', '비치', '시티', '그랜드',
];

type Hotel = { hotelId: string; hotelName: string };
type Account = {
  userId: string;
  maskedName: string;
  hasEmail: boolean;
  maskedEmail: string | null;
  hasPhone: boolean;
  maskedPhone: string | null;
};

/** 공개 검색 API로 결과가 있는 호텔 1건을 찾는다. */
async function findHotelWithAccounts(
  api: APIRequestContext,
): Promise<{ hotel: Hotel; accounts: Account[] } | null> {
  for (const term of SEARCH_TERMS) {
    const res = await api.post('/api/auth/password-reset/search-hotels', {
      data: { q: term },
    });
    if (!res.ok()) continue;
    const { hotels } = (await res.json()) as { hotels: Hotel[] };
    for (const hotel of hotels.slice(0, 5)) {
      const aRes = await api.post('/api/auth/password-reset/accounts', {
        data: { hotelId: hotel.hotelId },
      });
      if (!aRes.ok()) continue;
      const { accounts } = (await aRes.json()) as { accounts: Account[] };
      if (accounts.length > 0) return { hotel, accounts };
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────
// 공개(미인증) 플로우 — 안전(읽기 전용 + 가드)
// ─────────────────────────────────────────────────────────────────────

test.describe('AC-11 비밀번호 찾기 — 공개 플로우(안전)', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('S-01 로그인 화면에 "비밀번호를 잊으셨나요?" 링크 → /forgot-password 이동', async ({
    page,
  }) => {
    await page.goto('/login');
    const link = page.getByRole('link', { name: '비밀번호를 잊으셨나요?' });
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(/\/forgot-password/);
    await expect(
      page.getByRole('heading', { name: '비밀번호 찾기' }),
    ).toBeVisible();
  });

  test('S-02 1단계 호텔 검색 UI 렌더 (입력·버튼·안내)', async ({ page }) => {
    await page.goto('/forgot-password');
    await expect(page.locator('#hotel-q')).toBeVisible();
    await expect(page.getByRole('button', { name: '검색' })).toBeVisible();
    await expect(page.getByText('3글자 이상', { exact: false })).toBeVisible();
  });

  test('S-02b 3글자 미만이면 검색 버튼 비활성 + 안내 노출', async ({ page }) => {
    await page.goto('/forgot-password');
    const searchBtn = page.getByRole('button', { name: '검색' });
    // 2글자 입력 → 버튼 disabled + 안내문구
    await page.locator('#hotel-q').fill('더파');
    await expect(searchBtn).toBeDisabled();
    await expect(
      page.getByText('호텔명을 3글자 이상 입력해주세요.'),
    ).toBeVisible();
    // 공백 포함 "더 파" (의미 글자 2) 도 비활성
    await page.locator('#hotel-q').fill('더 파');
    await expect(searchBtn).toBeDisabled();
    // 3글자 채우면 활성화
    await page.locator('#hotel-q').fill('더파인');
    await expect(searchBtn).toBeEnabled();
  });

  test('S-03 존재하지 않는 호텔 검색 → 결과 없음 안내', async ({ page }) => {
    await page.goto('/forgot-password');
    await page.locator('#hotel-q').fill('절대존재하지않는호텔명ZZZ999');
    await page.getByRole('button', { name: '검색' }).click();
    await expect(
      page.getByText('검색 결과가 없습니다. 호텔명을 다시 확인해주세요.'),
    ).toBeVisible();
  });

  test('S-04 호텔 검색 → 계정 선택 → 채널 선택(마스킹 검증). 발송은 하지 않음', async ({
    page,
    request,
  }) => {
    const found = await findHotelWithAccounts(request);
    test.skip(
      !found,
      '검색 가능한 호텔/계정 데이터가 없어 스킵 (빈 DB)',
    );
    const { hotel, accounts } = found!;

    await page.goto('/forgot-password');
    // 호텔명 일부로 검색 — 공백 제외 3글자 이상이어야 검색 가능 (MIN_QUERY_LEN=3)
    const term = hotel.hotelName.replace(/\s/g, '').slice(0, 3);
    await page.locator('#hotel-q').fill(term);
    await page.getByRole('button', { name: '검색' }).click();

    // 결과에서 해당 호텔 선택
    const hotelBtn = page.getByRole('button', { name: hotel.hotelName }).first();
    await expect(hotelBtn).toBeVisible();
    await hotelBtn.click();

    // 계정 목록 노출 + 첫 계정 선택
    const acctBtn = page.getByRole('button', { name: accounts[0]!.maskedName }).first();
    await expect(acctBtn).toBeVisible();
    await acctBtn.click();

    // 채널 선택 단계 — 안내문 + 채널 버튼 중 1개 이상
    await expect(
      page.getByText('인증 정보를 받을 방법을 선택해주세요.'),
    ).toBeVisible();

    const acct = accounts[0]!;
    if (acct.hasEmail) {
      const emailBtn = page.getByText('이메일로 재설정 링크 받기');
      await expect(emailBtn).toBeVisible();
      // 마스킹 형식: 도메인 숨김 (…@***), 실제 TLD 노출 안 됨
      const emailHint = acct.maskedEmail!;
      expect(emailHint).toMatch(/@\*\*\*$/);
      expect(emailHint).not.toMatch(/\.(com|net|kr|org)/i);
      await expect(page.getByText(emailHint, { exact: false })).toBeVisible();
    }
    if (acct.hasPhone) {
      const smsBtn = page.getByText('문자로 인증코드 받기');
      await expect(smsBtn).toBeVisible();
      // 마스킹 형식: 끝 2자리만 (010-****-**78)
      expect(acct.maskedPhone!).toMatch(/^\d{3}-\*{4}-\*{2}\d{2}$/);
    }

    // ⚠️ 채널 버튼은 클릭하지 않는다 (클릭 = 실제 발송).
  });

  test('S-05 토큰 없이 /reset-password 접근 → 유효하지 않은 링크 안내', async ({
    page,
  }) => {
    await page.goto('/reset-password');
    await expect(
      page.getByRole('heading', { name: '유효하지 않은 링크입니다' }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: '비밀번호 찾기 다시 시작' }),
    ).toBeVisible();
  });

  test('S-06 잘못된 토큰으로 /reset-password 접근 → 유효하지 않은 링크 안내', async ({
    page,
  }) => {
    await page.goto('/reset-password?token=invalid-token-xxxxxxxxxxxxxxxxxxxx');
    await expect(
      page.getByRole('heading', { name: '유효하지 않은 링크입니다' }),
    ).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────
// 로그인 사용자 가드
// ─────────────────────────────────────────────────────────────────────

test.describe('AC-11 비밀번호 찾기 — 로그인 사용자 가드', () => {
  test.use({ storageState: STORAGE_STATE_PATHS.admin });

  test('S-07 로그인 상태에서 /forgot-password 접근 → 리다이렉트(찾기 화면 미노출)', async ({
    page,
  }) => {
    await page.goto('/forgot-password');
    await expect(page).not.toHaveURL(/\/forgot-password/);
  });

  test('S-08 로그인 상태에서 /reset-password 접근 → 리다이렉트', async ({
    page,
  }) => {
    await page.goto('/reset-password?token=whatever');
    await expect(page).not.toHaveURL(/\/reset-password/);
  });
});

// ─────────────────────────────────────────────────────────────────────
// 전체 해피패스 (격리 DB + 발송 스텁 전용) — 기본 SKIP
// ─────────────────────────────────────────────────────────────────────

test.describe('AC-11 비밀번호 찾기 — 전체 해피패스(LIVE 게이트)', () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  test.skip(
    process.env.E2E_PWRESET_LIVE !== '1',
    '실제 메일/문자 발송 + 비번 변경 위험 — 격리 DB(E2E_PWRESET_LIVE=1)에서만 실행',
  );

  test('S-09 문자 코드 발송 → 검증 → 새 비밀번호 설정 → 완료', async ({
    page,
    request,
  }) => {
    // NOTE: 격리 환경 전제.
    //  - SES/SOLAPI 키를 비워 발송을 스텁 처리할 것.
    //  - 코드/토큰은 DB에서 직접 조회해 입력 (별도 DB 헬퍼 필요).
    //  본 테스트는 구조만 제공하며, 실제 코드 조회는 격리 환경 구성 시 채운다.
    test.fixme(true, '격리 DB + DB 코드 조회 헬퍼 구성 후 활성화');
    void page;
    void request;
  });
});
