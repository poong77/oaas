/**
 * 메일&문자 — 메시지함 + 발송 화면 E2E (MSG-15~23 개편 반영).
 *
 * 실제 발송·DB쓰기는 비용·운영 영향(운영DB 직결)이 있어 수행하지 않고,
 * UI 구조/상호작용만 검증한다(비파괴).
 *
 * 검증 시나리오:
 *   M-01 탭 4개(메일/문자/템플릿/메시지함) 노출
 *   M-02 메시지함 검색조건 5종 + 20/50/100
 *   M-03 메시지함 신규 컬럼(제목·수신·결과·발송자) 또는 빈 상태
 *   M-04 메일 발신자명(기본 오아테크) + 주소 한 줄 + 미리보기 문자열 + 푸터
 *   M-05 메일 본문 변수 칩 4종
 *   M-06 문자 제목 필수 기본값 [오아테크] + 변수 칩 삽입 + LMS
 */

import { test, expect } from '@playwright/test';
import { STORAGE_STATE_PATHS } from './fixtures/users';

test.use({
  storageState: STORAGE_STATE_PATHS.admin,
  viewport: { width: 1440, height: 900 },
});

const URL = '/admin/insights/messaging';

test.describe('메일&문자 — 메시지함/발송', () => {
  test('M-01 탭 4개 노출', async ({ page }) => {
    await page.goto(URL);
    await expect(page.getByRole('button', { name: '메일 발송' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: '문자 발송' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: '템플릿', exact: true })).toBeVisible();
    const boxTab = page.getByRole('button', { name: '메시지함' });
    await expect(boxTab).toBeVisible();
    await boxTab.click();
    await expect(page.locator('input[type="date"]')).toHaveCount(2);
  });

  test('M-02 검색조건 5종 + 페이지당 20/50/100', async ({ page }) => {
    await page.goto(URL);
    await page.getByRole('button', { name: '메시지함' }).click();

    await expect(page.locator('input[type="date"]')).toHaveCount(2);
    await expect(page.locator('select')).toBeVisible();
    await expect(page.locator('input[placeholder="호텔명"]')).toBeVisible();
    await expect(page.locator('input[placeholder="email@…"]')).toBeVisible();
    await expect(page.locator('input[placeholder="010…"]')).toBeVisible();
    await expect(page.locator('select option', { hasText: '문자 SMS' })).toHaveCount(1);
    await expect(page.locator('select option', { hasText: '문자 LMS' })).toHaveCount(1);
    for (const ps of ['20', '50', '100']) {
      await expect(page.getByRole('button', { name: ps, exact: true })).toBeVisible();
    }
    await expect(page.getByRole('button', { name: '검색' })).toBeVisible();
    await expect(page.getByRole('button', { name: '초기화' })).toBeVisible();
  });

  test('M-03 메시지함 신규 컬럼 또는 빈 상태 (MSG-23)', async ({ page }) => {
    await page.goto(URL);
    await page.getByRole('button', { name: '메시지함' }).click();
    await expect(page.getByText('불러오는 중…')).toHaveCount(0, { timeout: 15_000 });

    const hasHeader = await page.getByRole('columnheader', { name: '수신', exact: true }).count();
    const hasEmpty = await page.getByText('발송 묶음이 없습니다').count();
    expect(hasHeader + hasEmpty).toBeGreaterThan(0);
    // 구 컬럼('총발송')은 더 이상 헤더에 없어야 한다
    await expect(page.getByRole('columnheader', { name: '총발송' })).toHaveCount(0);
  });

  test('M-04 메일 발신자명(오아테크) + 주소 한 줄 + 미리보기 + 푸터 (MSG-20)', async ({ page }) => {
    await page.goto(URL);
    await expect(page.getByText('@oapms.com', { exact: true })).toBeVisible();
    // 발신자명 기본값 오아테크
    await expect(page.locator('input[placeholder="발신자명 (예: 오아테크)"]')).toHaveValue('오아테크');
    const local = page.locator('input[placeholder="as"]');
    await expect(local).toHaveValue('as');
    // 미리보기 문자열
    await expect(page.getByText('오아테크 <as@oapms.com>')).toBeVisible();
    // 푸터
    await expect(page.getByText('(주)오아테크')).toBeVisible();
    await expect(page.getByText('Tel. 1833-4702', { exact: false })).toBeVisible();
  });

  test('M-05 메일 본문 변수 칩 4종', async ({ page }) => {
    await page.goto(URL);
    for (const v of ['+ 업체명', '+ 담당자명', '+ 연락처', '+ 호텔명']) {
      await expect(page.getByRole('button', { name: v }).first()).toBeVisible();
    }
  });

  test('M-06 문자 제목 필수 기본값 [오아테크] + 변수 삽입 + LMS (MSG-19)', async ({ page }) => {
    await page.goto(URL);
    await page.getByRole('button', { name: '문자 발송' }).click();

    // 제목 필수 + 기본값 [오아테크] → 이미 LMS
    const subject = page.locator('input[placeholder="[오아테크]"]');
    await expect(subject).toHaveValue('[오아테크]');
    await expect(page.getByText('LMS', { exact: true }).first()).toBeVisible();

    const body = page.locator('textarea[placeholder^="문자 본문"]');
    await expect(body).toBeVisible();
    await body.click();
    await page.getByRole('button', { name: '+ 업체명' }).first().click();
    await expect(body).toHaveValue(/#\{업체명\}/);
  });
});
