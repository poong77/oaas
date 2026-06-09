/**
 * master-restructure E2E — 마스터DB 5섹션 재구성 + 통합 2 + 삭제 2 (2026-06-09).
 *
 * 검증:
 *   - 인덱스 5섹션 헤더 + 통합/라벨 카드 노출, 삭제·구 단독 카드 미노출
 *   - 문의 분류(inquiry-classification) 탭: 이슈유형 ↔ 유입 채널
 *   - 메시지 템플릿(message-templates) 탭: 알림 ↔ 빠른 응대
 *   - 구 라우트 4종 → 통합 탭 permanentRedirect
 *   - 삭제 라우트 2종(quick-actions/form-fields) 404
 *   - 채널 편집 라우트 유지(통합 후에도 동작)
 *
 * @see docs/IMPLEMENTATION_PLAN.md §6 (마스터DB 재구성)
 */

import { test, expect } from '@playwright/test';
import { STORAGE_STATE_PATHS } from './fixtures/users';
import { expectNotFound } from './helpers/assert';

test.describe('마스터DB 재구성 (어드민)', () => {
  test.use({
    storageState: STORAGE_STATE_PATHS.admin,
    viewport: { width: 1440, height: 900 },
  });

  test('IDX-01: /admin/master 200 + 5개 섹션 헤더 노출', async ({ page }) => {
    const res = await page.goto('/admin/master');
    expect(res?.status()).toBe(200);
    await page.waitForLoadState('networkidle');

    for (const label of [
      '① 분류·구조',
      '② 접수·응대',
      '③ 랜딩페이지',
      '④ 검색·AI',
      '⑤ 시스템·운영',
    ]) {
      await expect(page.getByRole('heading', { name: label })).toBeVisible();
    }
  });

  test('IDX-02: 통합·라벨 카드 노출 / 삭제·구 단독 카드 미노출', async ({ page }) => {
    await page.goto('/admin/master');
    await page.waitForLoadState('networkidle');

    // 통합 + 라벨 변경 카드
    for (const name of ['문의 분류', '메시지 템플릿', '제품 카테고리', '아티클 메뉴 트리']) {
      await expect(page.getByRole('link', { name: new RegExp(name) })).toBeVisible();
    }

    // 삭제/구 단독 카드는 인덱스에 없어야 함
    for (const gone of ['자주 찾는 작업', '접수 폼 필드', '알림 템플릿', '빠른 응대', '유입 채널', '제품 분류', '메뉴 구조']) {
      await expect(
        page.getByRole('link', { name: gone, exact: true }),
      ).toHaveCount(0);
    }
  });

  test('INQ-01: 문의 분류 탭 — 기본 이슈유형 + 유입 채널 전환', async ({ page }) => {
    await page.goto('/admin/master/inquiry-classification');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: '문의 분류' })).toBeVisible();
    // 4개 탭 노출
    for (const tab of ['이슈 유형', '긴급도', '영향 범위', '유입 채널']) {
      await expect(page.getByRole('link', { name: tab, exact: true })).toBeVisible();
    }

    // 유입 채널 탭 클릭 → ?tab=channels + 신규 채널 액션 노출
    // (App Router 소프트 내비게이션은 서버 RSC fetch 후 URL 커밋 → waitForURL로 대기)
    await page.getByRole('link', { name: '유입 채널', exact: true }).click();
    await page.waitForURL(/tab=channels/, { timeout: 15_000 });
    await expect(page.getByRole('link', { name: /신규 채널/ })).toBeVisible();
  });

  test('MSG-01: 메시지 템플릿 탭 — 알림 기본 + 빠른 응대 전환', async ({ page }) => {
    await page.goto('/admin/master/message-templates');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: '메시지 템플릿' })).toBeVisible();
    await expect(page.getByText('알려진 event_key')).toBeVisible(); // 알림 탭 본문

    // 빠른 응대 탭 클릭 → ?tab=quick-reply (waitForURL로 RSC 커밋 대기)
    await page.getByRole('link', { name: '빠른 응대', exact: true }).click();
    await page.waitForURL(/tab=quick-reply/, { timeout: 15_000 });
    await expect(page.getByText('등록된 응대 문구가 없습니다').or(page.locator('text=편집').first())).toBeVisible();
  });

  test('RDR-01: 구 라우트 4종 → 통합 탭 리다이렉트', async ({ page }) => {
    const cases: Array<[string, string]> = [
      ['/admin/master/categories', 'inquiry-classification'],
      ['/admin/master/ticket-channels', 'tab=channels'],
      ['/admin/master/notification-templates', 'tab=notification'],
      ['/admin/master/quick-replies', 'tab=quick-reply'],
    ];
    for (const [from, expectedFragment] of cases) {
      await page.goto(from);
      await page.waitForLoadState('networkidle');
      expect(page.url(), `${from} → ${expectedFragment}`).toContain(expectedFragment);
    }
  });

  test('DEL-01: 삭제 라우트 2종 → 404', async ({ page }) => {
    for (const gone of ['/admin/master/quick-actions', '/admin/master/form-fields']) {
      await page.goto(gone);
      await page.waitForLoadState('networkidle');
      await expectNotFound(page);
    }
  });

  test('CHN-01: 채널 편집 라우트 유지 — 신규 채널 폼 200', async ({ page }) => {
    const res = await page.goto('/admin/master/ticket-channels/new');
    expect(res?.status()).toBe(200);
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: /새 유입 채널/ })).toBeVisible();
  });
});
