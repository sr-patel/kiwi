import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('browses, searches, paginates, and opens details with the keyboard', async ({ page }) => {
  await page.goto('/all');
  const firstCard = page.getByRole('button', { name: /^Open Bird/ }).first();
  await expect(firstCard).toBeVisible({ timeout: 30_000 });

  const search = page.getByRole('textbox', { name: 'Search', exact: true });
  await search.fill('Bird 037');
  await expect(page.getByRole('button', { name: 'Open Bird 037' })).toBeVisible();
  await search.clear();

  const birdsFolder = page.getByRole('button', { name: /Birds/ });
  if (!(await birdsFolder.isVisible())) await page.getByRole('button', { name: 'Open navigation' }).click();
  await birdsFolder.click();
  await expect(page).toHaveURL(/\/folder\//);
  await expect(page.getByRole('button', { name: /Open Bird/ }).first()).toBeVisible();

  await page
    .getByRole('button', { name: /Open Bird/ })
    .first()
    .focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();

  const allFiles = page.getByRole('button', { name: 'All Files' });
  if (!(await allFiles.isVisible())) await page.getByRole('button', { name: 'Open navigation' }).click();
  await allFiles.click();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect.poll(async () => page.getByRole('button', { name: /^Open Bird/ }).count()).toBeGreaterThan(50);
});

test('has no serious or critical accessibility violations in the library shell', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'library-chromium',
    'Run the full accessibility scan once on desktop Chromium.',
  );
  await page.goto('/all');
  await expect(page.getByRole('button', { name: /Open Bird/ }).first()).toBeVisible({ timeout: 30_000 });
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter(({ impact }) => impact === 'serious' || impact === 'critical')).toEqual(
    [],
  );
});

test('persists settings across reloads and keeps controls usable on responsive layouts', async ({ page }) => {
  await page.goto('/settings');
  const pageSize = page.getByRole('spinbutton', { name: 'Items per request' });
  await expect(pageSize).toBeVisible({ timeout: 30_000 });
  await pageSize.fill('20');
  await page.reload();
  await expect(page.getByRole('spinbutton', { name: 'Items per request' })).toHaveValue('20');
  await page.getByRole('button', { name: 'Library & Sync' }).click();
  await expect(page.getByRole('heading', { name: 'Library & Sync' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Library path' })).toHaveValue(/Acceptance\.library$/);
});

test('explores the Tag Atlas with search, detail presets, fit, and keyboard navigation', async ({
  page,
}, testInfo) => {
  await page.goto('/network');
  await expect(page.getByRole('heading', { name: 'Tag Atlas' })).toBeVisible({ timeout: 30_000 });
  const atlas = page.getByRole('application', { name: /Interactive tag atlas/ });
  await expect(atlas).toBeVisible();

  await page.getByRole('searchbox', { name: 'Find a tag in the atlas' }).fill('theme-1');
  await page.getByRole('button', { name: /#theme-1/ }).click();
  await expect(page.getByRole('heading', { name: '#theme-1' })).toBeVisible();
  await page.getByRole('button', { name: 'Close panel' }).click();

  await page.getByLabel('Detail').selectOption({ label: 'Deep' });
  await expect(atlas).toHaveAttribute('aria-label', /9 tags/);
  await page.getByRole('button', { name: 'Fit complete atlas' }).click();
  await atlas.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Tag items')).toBeVisible();

  if (testInfo.project.name === 'library-chromium') {
    await page.getByRole('button', { name: 'Close panel' }).click();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.filter(({ impact }) => impact === 'serious' || impact === 'critical')).toEqual(
      [],
    );
  }
});

test('fits the complete image at the largest scale supported by the viewport', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'library-chromium', 'Validate exact sizing once on desktop Chromium.');
  await page.goto('/all');
  await page.getByRole('button', { name: 'Open Bird 001' }).click();

  const viewport = page.getByTestId('detailed-media-viewport');
  const frame = page.getByTestId('detailed-media-frame');
  const image = frame.getByRole('img', { name: 'Bird 001' });
  await expect(image).toBeVisible({ timeout: 30_000 });
  await page.getByTitle('Zoom in (+)').click();
  await page.getByTitle('Expand to full height (V)').click();
  await page.getByTitle('Fit to screen (F)').click();
  await expect(page.getByText('100%')).toBeVisible();

  await expect
    .poll(async () => {
      const viewportBox = await viewport.boundingBox();
      const frameBox = await frame.boundingBox();
      if (!viewportBox || !frameBox) return null;
      return {
        fillsWidth: Math.abs(frameBox.width - viewportBox.width) < 1,
        fullyContained:
          frameBox.x >= viewportBox.x - 0.5 &&
          frameBox.y >= viewportBox.y - 0.5 &&
          frameBox.x + frameBox.width <= viewportBox.x + viewportBox.width + 0.5 &&
          frameBox.y + frameBox.height <= viewportBox.y + viewportBox.height + 0.5,
        preservesAspectRatio: Math.abs(frameBox.width / frameBox.height - 2) < 0.01,
      };
    })
    .toMatchObject({ fillsWidth: true, fullyContained: true, preservesAspectRatio: true });
});
