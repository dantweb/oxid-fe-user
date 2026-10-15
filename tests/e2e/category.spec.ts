import { expect, test } from '@playwright/test';
import { CAPS_CATEGORY_ID } from './fixtures/test-data';

test.describe('product category page', () => {
  test('catalog → category link → that category’s products → product detail', async ({ page }) => {
    await page.goto('/shop');
    const link = page.getByTestId('category-link').filter({ hasText: /^\s*Caps\s*$/ });
    await expect(link).toBeVisible({ timeout: 20_000 });
    await link.click();

    await expect(page).toHaveURL(new RegExp(`/shop/category/${CAPS_CATEGORY_ID}$`));
    await expect(page.getByTestId('category-title')).toHaveText('Caps');
    await expect(page).toHaveTitle(/Caps · OXID Storefront/);

    const cards = page.getByTestId('product-card');
    await expect(cards.first()).toBeVisible({ timeout: 20_000 });
    expect(await cards.count()).toBeGreaterThan(0);

    const title = await page.getByTestId('product-card-title').first().innerText();
    await cards.first().click();
    await expect(page.getByTestId('product-price')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
  });

  test('a category shows only its own products (fewer than the full catalog)', async ({ page }) => {
    await page.goto(`/shop/category/${CAPS_CATEGORY_ID}`);
    await expect(page.getByTestId('product-card').first()).toBeVisible({ timeout: 20_000 });
    // Caps is a small category: strictly fewer than a full 12-item catalog page
    expect(await page.getByTestId('product-card').count()).toBeLessThan(12);
  });

  test('category page head is indexable-friendly', async ({ page }) => {
    await page.goto(`/shop/category/${CAPS_CATEGORY_ID}`);
    await expect(page.getByTestId('category-title')).toHaveText('Caps', { timeout: 20_000 });
    await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(0);
  });
});
