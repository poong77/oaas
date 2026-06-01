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

// ──────────────────────────────────────────────────────────────────
// KB-09 — A6 재편집 (Phase 4) — UI 검증 (API mock는 v2)
// ──────────────────────────────────────────────────────────────────
//
// 본 시나리오는 RewritePanel UI 동작만 검증.
// 실제 aiRewriteArticleAction 호출(=Anthropic API)은 비용·결과 변동성 때문에 mock 인프라
// 마련 후 KB-09b로 확장. 현재는 본문 미만 비활성 / 4모드 라디오 / Haiku 배지 / custom 명령
// 입력 + 빠른 프리셋만 검증.
//
// 참조: DESIGN §16, lib/ai/prompts/article-rewriter.ts

test.describe('KB-09 A6 재편집 패널 UI (manager)', () => {
  test.use({ storageState: STORAGE_STATE_PATHS.manager });

  test('KB-09 신규 작성 페이지에 재편집 패널이 렌더되고 본문 50자 미만 시 트리거 비활성', async ({
    page,
  }) => {
    await page.goto('/admin/articles/new');

    // 패널 헤더 노출
    await expect(page.getByText('AI 재편집')).toBeVisible();

    // 본문 비어있음(골격 placeholder만) 상태 → 트리거 비활성
    const triggerBtn = page.getByRole('button', { name: /재편집 미리보기/ });
    await expect(triggerBtn).toBeDisabled();
    await expect(page.getByText('본문 50자 이상 입력 후 활성')).toBeVisible();
  });

  test('KB-09b 4모드 라디오 선택 + tone에 Haiku 배지', async ({ page }) => {
    await page.goto('/admin/articles/new');

    // 4모드 라벨 모두 노출
    await expect(page.getByText('골격 재정렬 (의도 변경)')).toBeVisible();
    await expect(page.getByText('빈 섹션 채우기')).toBeVisible();
    await expect(page.getByText('CS 톤 보정')).toBeVisible();
    await expect(page.getByText('자유 명령')).toBeVisible();

    // tone 모드에 Haiku 배지
    await expect(page.getByText('Haiku').first()).toBeVisible();

    // 라디오 선택 (tone → reorder)
    await page.getByRole('radio', { name: /골격 재정렬/ }).check();
    await expect(page.getByRole('radio', { name: /골격 재정렬/ })).toBeChecked();
  });

  test('KB-09c custom 모드 선택 시 자유 명령 입력란 + 빠른 프리셋 노출', async ({
    page,
  }) => {
    await page.goto('/admin/articles/new');

    // custom 모드 선택
    await page.getByRole('radio', { name: '자유 명령' }).check();

    // 자유 명령 Input 노출
    await expect(page.getByLabel(/자유 명령/)).toBeVisible();

    // 빠른 프리셋 5개 모두 노출
    for (const preset of ['더 짧게', '단계 자세히', '용어 통일', '초보 눈높이', '약어 풀어쓰기']) {
      await expect(page.getByRole('button', { name: preset })).toBeVisible();
    }

    // 프리셋 클릭 → 명령란 채워짐
    await page.getByRole('button', { name: '더 짧게' }).click();
    await expect(page.getByLabel(/자유 명령/)).toHaveValue(/줄/);
  });
});

// ──────────────────────────────────────────────────────────────────
// KB-04 (A5 적용) · KB-09b (A6 재편집 적용) — mock Anthropic (D5)
// ──────────────────────────────────────────────────────────────────
//
// E2E_MOCK_AI=1 환경변수에서만 활성. dev server를 다음처럼 띄우고 실행:
//   E2E_MOCK_AI=1 npm run dev
//   npx playwright test e2e/kb-knowledge-base.spec.ts -g "KB-04|KB-09b"
//
// production은 항상 mock 비활성 (lib/ai/mock.ts MOCK_ENABLED 분기).
//
// 참조: docs/04-report/knowledge-base-overhaul/REPORT-v1.6.md D5

const MOCK_ON = process.env.E2E_MOCK_AI === '1';

test.describe('KB-04 A5 AI 보조 적용 (mock)', () => {
  test.skip(!MOCK_ON, 'E2E_MOCK_AI=1 환경변수가 필요합니다');
  test.use({ storageState: STORAGE_STATE_PATHS.manager });

  test('KB-04 AI 자동 트리거 → slug/summary/keywords mock 제안 표시 → 적용', async ({
    page,
  }) => {
    await page.goto('/admin/articles/new');

    // 제품 선택 (AI 호출 활성화 조건)
    await page.getByLabel('제품 *').selectOption({ index: 1 });

    // 제목 입력 (활성 조건)
    await page.getByLabel('제목 *').fill('체크인 등록 테스트');

    // AI 자동 트리거 (slug 옆 버튼)
    await page.getByRole('button', { name: /AI 자동/ }).first().click();

    // mock 응답 → slug 제안 카드 노출
    await expect(page.getByText(/slug 제안/)).toBeVisible({ timeout: 5000 });

    // 적용 클릭 → slug 필드에 mock 값 채워짐
    await page.getByRole('button', { name: '적용' }).first().click();
    await expect(page.getByLabel(/Slug/)).toHaveValue(/.+-howto-.+/);
  });
});

test.describe('KB-09b A6 재편집 적용 (mock)', () => {
  test.skip(!MOCK_ON, 'E2E_MOCK_AI=1 환경변수가 필요합니다');
  test.use({ storageState: STORAGE_STATE_PATHS.manager });

  test('KB-09b tone 모드 → 미리보기 모달 → 전부 적용 → 본문 변경', async ({ page }) => {
    await page.goto('/admin/articles/new');

    // 의도 카드(howto) 클릭으로 본문 골격 주입 (50자+ 조건 충족)
    await page.getByRole('button', { name: '사용방법' }).click();

    // 약간의 본문 추가 (50자+ 보장)
    await page
      .locator('[contenteditable]')
      .first()
      .fill('## 목표\n프런트에서 호텔리어를 도와 체크인을 5분 안에 완료하세요. 단계는 매뉴얼대로 진행하세요.');

    // tone 모드 (기본) 트리거
    await page.getByRole('button', { name: /재편집 미리보기/ }).click();

    // 미리보기 모달 열림
    await expect(page.getByText(/재편집 미리보기/)).toBeVisible({ timeout: 5000 });

    // 전부 적용 클릭
    await page.getByRole('button', { name: /전부 적용/ }).click();

    // 토스트 노출 + 모달 닫힘
    await expect(page.getByText(/적용됐어요/)).toBeVisible();
  });
});
