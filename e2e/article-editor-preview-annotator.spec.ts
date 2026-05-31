/**
 * 아티클 편집기 — 미리보기(KB-09) + 이미지 마크업(KB-10) E2E.
 *
 * 시나리오:
 *   KB-09a 미리보기 버튼 노출 + 검증 실패 시 토스트
 *   KB-09b 미리보기 클릭 → 새 탭 → DRAFT 배너 + 본문 렌더
 *   KB-09c /articles-preview 직접 진입 (key 없음) → 안내 화면
 *   KB-09d /articles-preview 비인증 사용자 차단 (호텔리어 로그인)
 *   KB-10a 이미지 업로드 다이얼로그에 [마크업 편집] 버튼 (파일 선택 후)
 *   KB-10b 마크업 편집 진입 → 툴바 렌더 (도구·색상·프레임·완료)
 *
 * 미포함 (테스트 비용 ↑):
 *   - 캔버스 픽셀 단위 그리기 검증
 *   - 실행취소 / 리사이즈 / 텍스트 prompt
 *   - 실제 /api/upload 호출
 *
 * 실행:
 *   npx playwright test --config=e2e/playwright.config.ts \
 *     e2e/article-editor-preview-annotator.spec.ts --project=chromium --no-deps
 */

import { test, expect } from '@playwright/test';
import { STORAGE_STATE_PATHS } from './fixtures/users';

// 1x1 투명 PNG (test 픽스처 — 디스크 파일 없이 setInputFiles 가능)
const TINY_PNG_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

// ──────────────────────────────────────────────────────────────────
// KB-09 — 미리보기 (manager)
// ──────────────────────────────────────────────────────────────────

test.describe('KB-09 article editor preview', () => {
  test.use({ storageState: STORAGE_STATE_PATHS.manager });

  test('KB-09a 미리보기 버튼이 Draft/발행 사이에 노출된다', async ({ page }) => {
    await page.goto('/admin/articles/new');

    const previewBtn = page.getByRole('button', { name: /미리보기/ });
    await expect(previewBtn).toBeVisible();
    await expect(previewBtn).toBeEnabled();
  });

  test('KB-09b 제목 없는 상태로 미리보기 클릭 → 토스트 안내 + 새 탭 안 열림', async ({
    page,
    context,
  }) => {
    await page.goto('/admin/articles/new');

    // 새 탭이 열리지 않는 것을 검증하기 위해 popup 이벤트 race
    const popupPromise = context
      .waitForEvent('page', { timeout: 2000 })
      .catch(() => null);

    await page.getByRole('button', { name: /미리보기/ }).click();

    // 토스트: "제목을 입력해야 미리볼 수 있어요" (제품은 기본 선택돼 있음)
    await expect(page.getByText(/제목을 입력해야/)).toBeVisible({
      timeout: 5000,
    });

    const popup = await popupPromise;
    expect(popup).toBeNull();
  });

  test('KB-09c /articles-preview 페이지가 localStorage 데이터를 읽어 /help 레이아웃으로 렌더한다', async ({
    page,
  }) => {
    // 편집기 → 미리보기 흐름은 Tiptap cursor 동작이 헤드리스에서 불안정해
    // 이 시나리오는 preview 페이지의 렌더링만 독립 검증 (localStorage 직접 주입).
    // 편집기 측 [미리보기] 버튼 노출은 KB-09a 가 커버.

    const title = 'E2E 미리보기 테스트';
    const body = `## 단계\n\n실제 본문 미리보기 검증용 텍스트입니다.`;
    const nonce = 'e2e-test-nonce-' + Date.now();

    // 미리보기 페이지 로드 전에 localStorage 에 데이터 주입
    // (origin 일치 필요 — admin 경로로 먼저 이동해서 localStorage 세팅)
    await page.goto('/admin/articles');
    await page.evaluate(
      ({ key, data }) => {
        const payload = {
          data,
          savedAt: Date.now(),
        };
        localStorage.setItem('kb-preview:' + key, JSON.stringify(payload));
      },
      {
        key: nonce,
        data: {
          productCode: 'pms',
          productLabel: 'PMS',
          contentType: 'howto',
          categoryPath: ['객실관리'],
          title,
          slug: 'e2e-preview',
          summary: '미리보기 페이지 렌더링 검증용 요약입니다.',
          keywords: ['미리보기', '체크인', '예약'],
          bodyMarkdown: body,
          authorName: null,
          isPublishedSource: false,
        },
      },
    );

    // 같은 origin 의 미리보기 페이지로 이동
    await page.goto(`/articles-preview?key=${encodeURIComponent(nonce)}`);

    // DRAFT 배너
    await expect(page.getByText(/DRAFT 미리보기/).first()).toBeVisible();
    await expect(
      page.getByText(/저장되지 않은 임시 데이터/),
    ).toBeVisible();

    // 제목이 h1으로 렌더
    await expect(
      page.getByRole('heading', { name: title, level: 1 }),
    ).toBeVisible();

    // 요약 카드
    await expect(page.getByText(/30초 요약/)).toBeVisible();
    await expect(
      page.getByText('미리보기 페이지 렌더링 검증용 요약입니다.'),
    ).toBeVisible();

    // 본문 텍스트
    await expect(
      page.getByText('실제 본문 미리보기 검증용 텍스트입니다.'),
    ).toBeVisible();

    // 키워드 칩
    await expect(page.getByText('#미리보기')).toBeVisible();

    // 카테고리 뱃지
    await expect(page.getByText('객실관리').first()).toBeVisible();

    // 미표시 안내문
    await expect(page.getByText(/관련 문서 카드/)).toBeVisible();
  });

  test('KB-09d /articles-preview 직접 진입 (key 없음) → 안내 화면', async ({
    page,
  }) => {
    await page.goto('/articles-preview');

    await expect(
      page.getByRole('heading', {
        name: /미리보기 데이터를 찾을 수 없어요/,
      }),
    ).toBeVisible();

    // "아티클 목록으로" 링크
    await expect(
      page.getByRole('link', { name: /아티클 목록으로/ }),
    ).toBeVisible();
  });

  test('KB-09e DRAFT 배너 X 버튼으로 닫을 수 있다', async ({ page }) => {
    const nonce = 'e2e-banner-close-' + Date.now();
    await page.goto('/admin/articles');
    await page.evaluate(
      ({ key }) => {
        localStorage.setItem(
          'kb-preview:' + key,
          JSON.stringify({
            data: {
              productCode: 'pms',
              productLabel: 'PMS',
              contentType: 'howto',
              categoryPath: [],
              title: '배너 닫기 테스트',
              slug: 'banner-close',
              summary: '',
              keywords: [],
              bodyMarkdown: '## 본문\n\n배너 닫기 검증.',
              authorName: null,
              isPublishedSource: false,
            },
            savedAt: Date.now(),
          }),
        );
      },
      { key: nonce },
    );
    await page.goto(`/articles-preview?key=${encodeURIComponent(nonce)}`);

    const banner = page.getByText(/DRAFT 미리보기/).first();
    await expect(banner).toBeVisible();

    await page.getByRole('button', { name: '배너 닫기' }).click();
    await expect(banner).not.toBeVisible();
  });
});

// ──────────────────────────────────────────────────────────────────
// KB-09f — 미리보기 권한 (호텔리어 차단)
// ──────────────────────────────────────────────────────────────────

test.describe('KB-09f preview auth — hotelier blocked', () => {
  test.use({ storageState: STORAGE_STATE_PATHS.hotelier });

  test('KB-09f 호텔리어는 /articles-preview 진입 시 권한 차단 (로그인 redirect 또는 403)', async ({
    page,
  }) => {
    const res = await page.goto('/articles-preview?key=fake');
    // requireRole 이 throw → /login 으로 redirect 또는 NextAuth 401
    // 둘 중 어느 경로든 미리보기 안내 화면은 보이지 않아야 함
    await expect(
      page.getByRole('heading', {
        name: /미리보기 데이터를 찾을 수 없어요/,
      }),
    ).not.toBeVisible();

    // 추가로 URL 또는 status로 검증
    const status = res?.status() ?? 0;
    const url = page.url();
    const blocked =
      status === 401 ||
      status === 403 ||
      status === 404 ||
      /\/login/.test(url);
    expect(blocked).toBeTruthy();
  });
});

// ──────────────────────────────────────────────────────────────────
// KB-10 — 이미지 마크업 다이얼로그 (manager)
// ──────────────────────────────────────────────────────────────────

test.describe('KB-10 image upload dialog — 마크업 편집', () => {
  test.use({ storageState: STORAGE_STATE_PATHS.manager });

  test('KB-10a 이미지 업로드 다이얼로그 열림 + 파일 선택 후 [마크업 편집] 노출', async ({
    page,
  }) => {
    await page.goto('/admin/articles/new');

    // 본문 RichEditor 내부 이미지 버튼 — toolbar 상단의 image icon
    // (lite/full toolbar 둘 다 ImageIcon button 사용)
    // dialog 띄우는 가장 안정적인 방법: full toolbar 안 button[title*="이미지"]
    const imageBtn = page
      .getByRole('button', { name: /이미지/ })
      .first();
    await imageBtn.click();

    // 다이얼로그 노출
    const dialog = page.getByRole('dialog', { name: '이미지 업로드' });
    await expect(dialog).toBeVisible();

    // 파일 선택 (1x1 PNG)
    await dialog.locator('input[type="file"]').setInputFiles({
      name: 'test-screenshot.png',
      mimeType: 'image/png',
      buffer: TINY_PNG_BUFFER,
    });

    // [마크업 편집] 버튼 노출
    await expect(
      dialog.getByRole('button', { name: /마크업 편집/ }),
    ).toBeVisible();

    // 닫기
    await dialog.getByRole('button', { name: '닫기' }).click();
    await expect(dialog).not.toBeVisible();
  });

  test('KB-10b [마크업 편집] 클릭 → 툴바·캔버스 영역·완료 버튼 렌더', async ({
    page,
  }) => {
    await page.goto('/admin/articles/new');

    const imageBtn = page
      .getByRole('button', { name: /이미지/ })
      .first();
    await imageBtn.click();

    const dialog = page.getByRole('dialog', { name: '이미지 업로드' });
    await dialog.locator('input[type="file"]').setInputFiles({
      name: 'test-screenshot.png',
      mimeType: 'image/png',
      buffer: TINY_PNG_BUFFER,
    });

    await dialog.getByRole('button', { name: /마크업 편집/ }).click();

    // 헤더 — "이미지 마크업"
    await expect(dialog.getByText('이미지 마크업')).toBeVisible({
      timeout: 10_000,
    });

    // 툴바 — title 속성 기반 locator (dynamic import + 컴파일 대기 30s)
    // (getByRole('button', { name: '빨강' }) 가 헤드리스 Chromium 에서 인식 안 되는 케이스 회피)
    await expect(
      dialog.locator('button[title="빨강"]'),
    ).toBeVisible({ timeout: 30_000 });
    await expect(dialog.locator('button[title="노랑"]')).toBeVisible();
    await expect(dialog.locator('button[title="파랑"]')).toBeVisible();

    // 도구 4개 — title 속성
    await expect(
      dialog.locator('button[title="선택 (커서)"]'),
    ).toBeVisible();
    await expect(dialog.locator('button[title="화살표"]')).toBeVisible();
    await expect(dialog.locator('button[title="박스"]')).toBeVisible();
    await expect(
      dialog.locator('button[title^="텍스트"]'),
    ).toBeVisible();

    // 프레임 토글 2개
    await expect(
      dialog.locator('button[title="프레임 없음"]'),
    ).toBeVisible();
    await expect(
      dialog.locator('button[title="그림자 프레임"]'),
    ).toBeVisible();

    // 완료 버튼
    await expect(
      dialog.getByRole('button', { name: /편집 완료/ }),
    ).toBeVisible();

    // 업로드 화면으로 돌아가기 버튼
    await expect(
      dialog.getByRole('button', { name: /업로드 화면으로/ }),
    ).toBeVisible();
  });

  test('KB-10c 마크업 편집 → [업로드 화면으로] 돌아가면 [마크업 편집] 버튼이 다시 활성', async ({
    page,
  }) => {
    await page.goto('/admin/articles/new');

    await page.getByRole('button', { name: /이미지/ }).first().click();
    const dialog = page.getByRole('dialog', { name: '이미지 업로드' });

    await dialog.locator('input[type="file"]').setInputFiles({
      name: 'test-screenshot.png',
      mimeType: 'image/png',
      buffer: TINY_PNG_BUFFER,
    });

    await dialog.getByRole('button', { name: /마크업 편집/ }).click();
    await expect(dialog.getByText('이미지 마크업')).toBeVisible({
      timeout: 10_000,
    });

    await dialog.getByRole('button', { name: /업로드 화면으로/ }).click();

    // 다시 select stage — 파일명 유지
    await expect(dialog.getByText(/test-screenshot.png/)).toBeVisible();
    await expect(
      dialog.getByRole('button', { name: /마크업 편집/ }),
    ).toBeVisible();
  });
});
