/**
 * knowledge-base-overhaul E2E (v1.5).
 *
 * 시나리오:
 *   - KB-01 smoke: /admin/articles/new 진입 + 새 에디터 셸 렌더링 (manager 인증)
 *                  · IntentSelector / MenuPathCascader / EditorMetaForm / AI 트리거
 *                  · AI 자동 버튼은 빈 본문에서 비활성
 *                  · 발행 버튼은 Hard 미충족 시 disabled
 *   - KB-07: /help/cms (비회원) 메뉴 트리 사이드바 노출 + 노드 펼침 + URL ?path 동기
 *   - KB-08: /role/front (비회원) DB 폴백 페이지 로드 + 다른 역할 링크 4개
 *
 * 미포함 (별도 사이클):
 *   - KB-02/KB-03 feature/troubleshoot 작성 흐름
 *   - KB-04 AI 보조 호출 (mock Anthropic 필요)
 *   - KB-05/KB-06 manual fallback / API 장애
 *   - KB-09 재편집 4모드 (Phase 4)
 *
 * 실행:
 *   npx playwright test --config=e2e/playwright.config.ts e2e/kb-knowledge-base.spec.ts \
 *     --project=chromium --no-deps
 *
 *   # 프로덕션 대상 (DB 변경 위험 — 읽기 시나리오만 권장):
 *   E2E_BASE_URL=https://support.oapms.com npx playwright test \
 *     --config=e2e/playwright.config.ts e2e/kb-knowledge-base.spec.ts -g "KB-07|KB-08"
 *
 * @see docs/02-design/knowledge-base-overhaul/DESIGN.md §10, §15-3, §16-7
 */

import { test, expect } from '@playwright/test';
import { STORAGE_STATE_PATHS } from './fixtures/users';

// ──────────────────────────────────────────────────────────────────
// KB-01 — 새 에디터 셸 진입 smoke (manager)
// ──────────────────────────────────────────────────────────────────

test.describe('KB-01 article editor shell (manager)', () => {
  test.use({ storageState: STORAGE_STATE_PATHS.manager });

  test('KB-01 신규 작성 페이지가 새 에디터 셸로 렌더링되고 AI 트리거 버튼이 라벨 옆에 배치된다', async ({
    page,
  }) => {
    await page.goto('/admin/articles/new');

    // IntentSelector — 3개 카드
    await expect(page.getByRole('button', { name: '사용방법' })).toBeVisible();
    await expect(page.getByRole('button', { name: '기능설명' })).toBeVisible();
    await expect(page.getByRole('button', { name: '문제해결' })).toBeVisible();

    // EditorMetaForm — 핵심 필드
    await expect(page.getByLabel('제품 *')).toBeVisible();
    await expect(page.getByLabel(/Slug \(URL\)/)).toBeVisible();
    await expect(page.getByLabel(/제목 \*/)).toBeVisible();
    await expect(page.getByLabel(/요약/)).toBeVisible();

    // AI 트리거 버튼은 각 필드 라벨 옆에 배치됨 (4곳 이상)
    const aiButtons = page.getByRole('button', { name: 'AI 자동' });
    await expect(aiButtons).toHaveCount(4);

    // 본문 비어있고 제목 없음 → AI 버튼 모두 비활성
    for (let i = 0; i < 4; i++) {
      await expect(aiButtons.nth(i)).toBeDisabled();
    }

    // 사이드바 체크리스트 (발행 준비 진척률)
    await expect(page.getByText(/발행 준비/)).toBeVisible();

    // 발행 버튼은 Hard 미충족 시 disabled
    const publishBtn = page.getByRole('button', { name: /발행/ }).first();
    await expect(publishBtn).toBeDisabled();
  });

  test('KB-01b 의도 카드 클릭 → 본문 골격 자동 주입 (빈 본문 → confirm 없이 즉시)', async ({
    page,
  }) => {
    await page.goto('/admin/articles/new');

    // 본문 골격이 처음부터 howto로 주입되어 있어야 함 (defaultContentType=howto)
    // RichEditor의 contenteditable 영역에서 "## 목표" 텍스트 확인
    const editor = page.locator('[contenteditable]').first();
    await expect(editor).toContainText('목표');
    await expect(editor).toContainText('사전 준비');
    await expect(editor).toContainText('단계');
    await expect(editor).toContainText('다음 단계');

    // 기능설명 카드 클릭 → 빈 본문이므로 confirm 없이 즉시 골격 교체
    await page.getByRole('button', { name: '기능설명' }).click();
    await expect(editor).toContainText('개요');
    await expect(editor).toContainText('위치');
    await expect(editor).toContainText('항목 설명');
    await expect(editor).toContainText('관련 문서');
  });

  test('KB-01c 키워드 입력 — 영어는 거부, 한글만 허용', async ({ page }) => {
    await page.goto('/admin/articles/new');

    const keywordInput = page.getByPlaceholder(/키워드 추가/);

    // 영어 입력 → 거부 (토스트 메시지)
    await keywordInput.fill('check-in');
    await keywordInput.press('Enter');
    await expect(
      page.getByText(/키워드는 한글만 입력할 수 있어요/),
    ).toBeVisible({ timeout: 5000 });

    // 한글 입력 → 추가됨 (칩으로 표시)
    await keywordInput.fill('체크인');
    await keywordInput.press('Enter');
    await expect(
      page.locator('button', { hasText: '체크인 삭제' }).first(),
    ).toBeVisible();
  });
});

// ──────────────────────────────────────────────────────────────────
// KB-07 — /help/cms 메뉴 트리 사이드바 (비회원)
// ──────────────────────────────────────────────────────────────────

test.describe('KB-07 /help/[product] menu_taxonomies 트리 (public)', () => {
  test('KB-07 사이드바 트리 노출 + 노드 클릭 시 URL ?path 동기화', async ({ page }) => {
    await page.goto('/help/cms');

    // PageHeader 노출 확인 (h1만 — 아티클 카드 h3와 구분)
    await expect(
      page.getByRole('heading', { name: /가이드/, level: 1 }),
    ).toBeVisible();

    // MenuTreeSidebar — 카테고리 헤더 + "전체" 링크
    await expect(page.getByText('카테고리').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /전체/ })).toBeVisible();

    // 다른 제품 사이드바 카드
    await expect(
      page.getByRole('heading', { name: '다른 제품' }),
    ).toBeVisible();

    // 1단계 노드가 하나라도 있으면 클릭해서 URL ?path 동기 확인
    const l1Nodes = page.getByTestId('menu-tree-node-l1');
    const count = await l1Nodes.count();
    if (count > 0) {
      const firstL1Label = await l1Nodes.first().locator('button').first().innerText();
      await l1Nodes.first().locator('button').first().click();

      // URL에 ?path= 포함 (encoded)
      await expect(page).toHaveURL(/[?&]path=/);
      // selected 노드는 brand 강조
      await expect(
        page.locator('button', { hasText: firstL1Label }).first(),
      ).toBeVisible();
    } else {
      // 메뉴 마스터가 비어있을 때 안내 텍스트
      await expect(page.getByText(/메뉴 마스터가 비어 있습니다/)).toBeVisible();
    }
  });
});

// ──────────────────────────────────────────────────────────────────
// KB-08 — /role/[key] DB 폴백 (public)
// ──────────────────────────────────────────────────────────────────

test.describe('KB-08 /role/[key] DB 연동 (public)', () => {
  test('KB-08 /role/front 페이지 로드 + 4개 다른 역할 링크', async ({ page }) => {
    await page.goto('/role/front');

    // PageHeader — "프론트 시작하기" (DB 또는 정적 폴백)
    await expect(
      page.getByRole('heading', { name: /시작하기/ }).first(),
    ).toBeVisible();

    // 페이지 testid (B2)
    await expect(page.getByTestId('role-starter-page')).toBeVisible();

    // 다른 역할 4개 (front 제외) 링크 노출
    const otherLinks = page.locator('a[href^="/role/"]');
    await expect(otherLinks).toHaveCount(4);

    // 매핑된 아티클이 있으면 카드, 없으면 EmptyState
    const cards = page.getByTestId('role-article-card');
    const emptyState = page.getByText(/추천 가이드가 준비 중/);
    const hasCards = (await cards.count()) > 0;
    const hasEmpty = await emptyState.isVisible().catch(() => false);
    expect(hasCards || hasEmpty).toBe(true);
  });

  test('KB-08b 존재하지 않는 role key는 404', async ({ page }) => {
    const res = await page.goto('/role/__nonexistent__');
    // notFound() → 404
    expect(res?.status()).toBe(404);
  });
});
