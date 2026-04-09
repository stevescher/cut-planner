import { test, expect } from '@playwright/test';

/**
 * Core smoke tests for Cut Planner.
 *
 * Run with: npx playwright test
 * Requires the dev server to be running (or will auto-start via playwright.config.ts webServer).
 *
 * These tests catch regressions like the CSP breakage (OPUS-109) that silently
 * disabled all interactive elements while the page still appeared to load.
 */

test('page loads without uncaught errors', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await page.goto('/');
  await page.waitForLoadState('networkidle');

  expect(pageErrors, 'Uncaught page errors found').toHaveLength(0);
});

test('"Add Panel" button adds a new panel row', async ({ page }) => {
  await page.goto('/');

  // Default state: one panel row with placeholder "Panel 1"
  await expect(page.getByPlaceholder('Panel 1')).toBeVisible();
  await expect(page.getByPlaceholder('Panel 2')).not.toBeVisible();

  await page.getByRole('button', { name: 'Add Panel' }).click();

  await expect(page.getByPlaceholder('Panel 2')).toBeVisible();
});

test('sheet size preset dropdown opens and selecting a preset updates dimensions', async ({ page }) => {
  await page.goto('/');

  // The StockPresetSelect renders a combobox with placeholder "Sheet size..."
  // It's the first combobox in the sidebar
  const presetTrigger = page.getByRole('combobox').first();
  await expect(presetTrigger).toBeVisible();
  await expect(presetTrigger).toContainText('Sheet size');

  await presetTrigger.click();

  // Preset options should appear in a listbox
  const firstOption = page.getByRole('option').first();
  await expect(firstOption).toBeVisible();

  const presetText = (await firstOption.textContent()) ?? '';
  await firstOption.click();

  // Trigger should now show the selected preset label (no longer "Sheet size...")
  await expect(presetTrigger).not.toContainText('Sheet size');
  await expect(presetTrigger).toContainText(presetText.trim().slice(0, 6)); // first chars of label
});

test('"Plan Cuts" is enabled with valid inputs and produces layout results', async ({ page }) => {
  await page.goto('/');

  // Default stock sheet (96" × 48") is already valid.
  // Fill in panel dimensions (defaults are 0, which disables Plan Cuts).
  const panelLengthInput = page.getByPlaceholder('24').first();
  const panelWidthInput = page.getByPlaceholder('12').first();

  await panelLengthInput.click();
  await panelLengthInput.fill('24');
  await panelWidthInput.click();
  await panelWidthInput.fill('12');
  await panelWidthInput.press('Tab'); // commit via blur

  // Plan Cuts button should now be enabled
  const planCutsBtn = page.getByRole('button', { name: 'Plan Cuts' });
  await expect(planCutsBtn).toBeEnabled();

  await planCutsBtn.click();

  // Layout results should appear: "Sheets" and "Waste" stats are shown for every solution
  await expect(page.getByText('Sheets', { exact: true })).toBeVisible();
  await expect(page.getByText('Waste', { exact: true })).toBeVisible();
});
