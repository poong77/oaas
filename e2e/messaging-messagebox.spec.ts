/**
 * 메일&문자 — 메시지함 + 발송 화면 개편 E2E.
 *
 * 변경 배경: '지난 이력' 탭을 '메시지함'(발송 묶음 테이블)으로 대체하고,
 * 메일 발신자 앞부분 입력(@oapms.com 고정)·문자 제목(선택)·본문 변수 칩·
 * 메일 푸터 미리보기를 추가했다.
 *
 * 실제 발송은 비용·운영 영향이 있어 검증하지 않고, UI 구조/상호작용만 확인한다.
 *
 * 검증 시나리오:
 *   M-01 탭이 3개(메일/문자/메시지함)이고 메시지함이 노출된다
 *   M-02 메시지함 검색조건 5종(발송일·유형·업체명·메일주소·문자번호) + 20/50/100
 *   M-03 메시지함 테이블 헤더 또는 빈 상태가 노출된다
 *   M-04 메일 탭: 발신자 앞부분 입력 + @oapms.com 고정 + 푸터 미리보기
 *   M-05 메일 탭: 본문 변수 칩 4종 노출
 *   M-06 문자 탭: 제목(선택) + 변수 칩 클릭 시 본문에 토큰 삽입 + LMS 전환
 */

import { test, expect } from '@playwright/test';
import { STORAGE_STATE_PATHS } from './fixtures/users';

test.use({
  storageState: STORAGE_STATE_PATHS.admin,
  viewport: { width: 1440, height: 900 },
});

const URL = '/admin/insights/messaging';

test.describe('메일&문자 — 메시지함', () => {
  test('M-01 탭 3개 + 메시지함 노출', async ({ page }) => {
    await page.goto(URL);
    // 탭 버튼('메일 발송')은 하단 발송 버튼과 이름이 같아 첫 번째(탭)로 한정.
    await expect(page.getByRole('button', { name: '메일 발송' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: '문자 발송' }).first()).toBeVisible();
    const boxTab = page.getByRole('button', { name: '메시지함' });
    await expect(boxTab).toBeVisible();
    await boxTab.click();
    // 메시지함 진입 → 발송일 기간 입력(date 2개) 노출
    await expect(page.locator('input[type="date"]')).toHaveCount(2);
  });

  test('M-02 검색조건 5종 + 페이지당 20/50/100', async ({ page }) => {
    await page.goto(URL);
    await page.getByRole('button', { name: '메시지함' }).click();

    // 발송일(기간) · 유형(select) · 업체명/메일주소/문자번호(placeholder)
    await expect(page.locator('input[type="date"]')).toHaveCount(2);
    await expect(page.locator('select')).toBeVisible();
    await expect(page.locator('input[placeholder="호텔명"]')).toBeVisible();
    await expect(page.locator('input[placeholder="email@…"]')).toBeVisible();
    await expect(page.locator('input[placeholder="010…"]')).toBeVisible();
    // 유형 select 옵션 확인
    await expect(page.locator('select option', { hasText: '문자 SMS' })).toHaveCount(1);
    await expect(page.locator('select option', { hasText: '문자 LMS' })).toHaveCount(1);
    // 페이지당 토글
    for (const ps of ['20', '50', '100']) {
      await expect(page.getByRole('button', { name: ps, exact: true })).toBeVisible();
    }
    // 검색/초기화 버튼
    await expect(page.getByRole('button', { name: '검색' })).toBeVisible();
    await expect(page.getByRole('button', { name: '초기화' })).toBeVisible();
  });

  test('M-03 메시지함 테이블 헤더 또는 빈 상태', async ({ page }) => {
    await page.goto(URL);
    await page.getByRole('button', { name: '메시지함' }).click();
    // 로딩 종료 대기
    await expect(page.getByText('불러오는 중…')).toHaveCount(0, { timeout: 15_000 });

    const hasHeader = await page.getByText('총발송', { exact: true }).count();
    const hasEmpty = await page.getByText('발송 묶음이 없습니다').count();
    expect(hasHeader + hasEmpty).toBeGreaterThan(0);
  });

  test('M-04 메일 발신자 앞부분 입력 + 도메인 고정 + 푸터 미리보기', async ({ page }) => {
    await page.goto(URL);
    // 기본 탭이 메일 — 도메인 고정 suffix(정확히 '@oapms.com')
    await expect(page.getByText('@oapms.com', { exact: true })).toBeVisible();
    const local = page.locator('input[placeholder="as"]');
    await expect(local).toHaveValue('as');
    await local.fill('support');
    await expect(local).toHaveValue('support');
    // 푸터 미리보기
    await expect(page.getByText('(주)오아테크')).toBeVisible();
    await expect(page.getByText('Tel. 1833-4702', { exact: false })).toBeVisible();
  });

  test('M-05 메일 본문 변수 칩 4종', async ({ page }) => {
    await page.goto(URL);
    for (const v of ['+ 업체명', '+ 담당자명', '+ 연락처', '+ 호텔명']) {
      await expect(page.getByRole('button', { name: v })).toBeVisible();
    }
  });

  test('M-06 문자 제목(선택) + 변수 칩 삽입 + LMS 전환', async ({ page }) => {
    await page.goto(URL);
    await page.getByRole('button', { name: '문자 발송' }).click();

    // 제목(선택) 필드
    const subject = page.locator('input[placeholder="제목 입력 시 LMS로 발송됩니다"]');
    await expect(subject).toBeVisible();

    const body = page.locator('textarea[placeholder^="문자 본문"]');
    await expect(body).toBeVisible();

    // 변수 칩 클릭 → 본문에 토큰 삽입
    await body.click();
    await page.getByRole('button', { name: '+ 업체명' }).click();
    await expect(body).toHaveValue(/#\{업체명\}/);

    // 제목 입력 → LMS 전환 (제목 입력 전 SMS, 입력 후 LMS)
    await subject.fill('점검 안내');
    await expect(page.getByText('LMS', { exact: true }).first()).toBeVisible();
  });
});
