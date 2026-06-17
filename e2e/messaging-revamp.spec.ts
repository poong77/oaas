/**
 * 메일&문자 개편 MSG-15~23 — 읽기전용 E2E.
 *
 * ⚠️ 운영DB 직결 환경 — 실제 발송/DB쓰기(템플릿 저장·발송·테스트발송 확정) 금지.
 *    모달은 열고 '취소'로 닫는다. 발송 버튼은 클릭하지 않는다.
 *
 * 시나리오:
 *   R-15 변수 칩 삽입 시 '변수 값' 패널(소스 select) 노출
 *   R-21a 문자 좌우 분할 — 본문 입력이 우측 미리보기에 실시간 반영
 *   R-21b 메일 미리보기 모달 열기/닫기
 *   R-22  테스트 발송 모달 열기/닫기 (발송 미수행)
 *   R-16  템플릿 탭 + 새 템플릿 모달 열기/닫기 (저장 미수행)
 *   R-17/18 수신자 선택기 엑셀 업로드·호텔리어 전체·양식 다운로드 UI
 */

import { test, expect } from '@playwright/test';
import { STORAGE_STATE_PATHS } from './fixtures/users';

test.use({
  storageState: STORAGE_STATE_PATHS.admin,
  viewport: { width: 1440, height: 900 },
});

const URL = '/admin/insights/messaging';

test.describe('메일&문자 개편 (MSG-15~23)', () => {
  test('R-15 변수 칩 삽입 시 변수 값 패널 노출', async ({ page }) => {
    await page.goto(URL);
    await page.getByRole('button', { name: '문자 발송' }).click();
    // 초기에는 본문에 토큰 없음 → 패널 숨김
    await expect(page.getByText('변수 값', { exact: true })).toHaveCount(0);
    // 변수 칩 클릭 → 토큰 삽입 → 패널 노출
    await page.locator('textarea[placeholder^="문자 본문"]').click();
    await page.getByRole('button', { name: '+ 담당자명' }).first().click();
    await expect(page.getByText('변수 값', { exact: true })).toBeVisible();
    // 소스 select 옵션 3종
    await expect(page.getByRole('option', { name: '연락처 자동주입' }).first()).toBeAttached();
    await expect(page.getByRole('option', { name: '직접입력' }).first()).toBeAttached();
    await expect(page.getByRole('option', { name: '엑셀 열' }).first()).toBeAttached();
  });

  test('R-21a 문자 본문 입력이 우측 미리보기에 실시간 반영', async ({ page }) => {
    await page.goto(URL);
    await page.getByRole('button', { name: '문자 발송' }).click();
    const body = page.locator('textarea[placeholder^="문자 본문"]');
    await body.fill('안녕하세요 점검안내드립니다');
    // 우측 휴대폰 말풍선(div)에 동일 텍스트가 실시간 렌더된다. textarea와 중복 매칭되므로 div로 한정.
    await expect(
      page.locator('div.whitespace-pre-wrap').filter({ hasText: '안녕하세요 점검안내드립니다' }),
    ).toBeVisible();
  });

  test('R-21b 메일 미리보기 모달 열기/닫기', async ({ page }) => {
    await page.goto(URL);
    // 발송 가능 최소 입력 없이도 미리보기 모달은 열린다(렌더 검증)
    await page.getByRole('button', { name: '미리보기', exact: true }).click();
    await expect(page.getByText('메일 미리보기 (샘플 수신자 기준)')).toBeVisible();
    await expect(page.getByText('보내는 사람')).toBeVisible();
    // 닫기 (X)
    await page.keyboard.press('Escape');
    await expect(page.getByText('메일 미리보기 (샘플 수신자 기준)')).toHaveCount(0);
  });

  test('R-22 테스트 발송 모달 열기/닫기 (발송 미수행)', async ({ page }) => {
    await page.goto(URL);
    await page.getByRole('button', { name: '테스트 발송' }).click();
    await expect(page.getByText('테스트 받을 이메일')).toBeVisible();
    // 취소로 닫기 — 실제 발송 안 함
    await page.getByRole('button', { name: '취소', exact: true }).click();
    await expect(page.getByText('테스트 받을 이메일')).toHaveCount(0);
  });

  test('R-16 템플릿 탭 + 새 템플릿 모달 열기/닫기 (저장 미수행)', async ({ page }) => {
    await page.goto(URL);
    await page.getByRole('button', { name: '템플릿', exact: true }).click();
    // 로딩 종료
    await expect(page.getByRole('button', { name: '새 템플릿' })).toBeVisible();
    await page.getByRole('button', { name: '새 템플릿' }).click();
    // 모달: 채널 선택 메일/문자 + 변수명 추가
    await expect(page.getByText('변수명 추가', { exact: false })).toBeVisible();
    await expect(page.getByPlaceholder('예: 객실수')).toBeVisible();
    // 취소로 닫기 — 저장 안 함
    await page.getByRole('button', { name: '취소', exact: true }).click();
    await expect(page.getByText('변수명 추가', { exact: false })).toHaveCount(0);
  });

  test('R-17/18 수신자 선택기 — 엑셀/호텔리어/양식 UI', async ({ page }) => {
    await page.goto(URL);
    // 메일 탭 기본
    await expect(page.getByRole('button', { name: '엑셀 업로드' })).toBeVisible();
    await expect(page.getByRole('button', { name: '호텔리어 전체' })).toBeVisible();
    await expect(page.getByRole('link', { name: '양식 다운로드' })).toBeVisible();
    // 양식 다운로드 링크가 올바른 엔드포인트를 가리킨다
    await expect(page.getByRole('link', { name: '양식 다운로드' })).toHaveAttribute(
      'href',
      '/api/admin/messaging/recipient-template',
    );
  });
});
