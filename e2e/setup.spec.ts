import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('first-run setup is keyboard operable and accessible', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Welcome to Kiwi' })).toBeVisible();

  await page.getByRole('button', { name: 'Next' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText('Your Eagle library')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled();

  const results = await new AxeBuilder({ page }).analyze();
  const severe = results.violations.filter((violation) =>
    ['serious', 'critical'].includes(violation.impact ?? ''),
  );
  expect(severe).toEqual([]);
});

test('setup remains usable at a narrow viewport', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Welcome to Kiwi' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next' })).toBeInViewport();
});
