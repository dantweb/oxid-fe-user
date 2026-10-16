import { expect, test } from '@playwright/test';
import { productsPerPage } from './helpers/instance-config';

test.describe('catalog page', () => {
  test('renders product cards with title, price and image', async ({ page }) => {
    await page.goto('/shop');

    const cards = page.getByTestId('product-card');
    await expect(cards.first()).toBeVisible({ timeout: 20_000 });
    await expect(cards).toHaveCount(productsPerPage()); // from oxid-config.yaml

    await expect(page.getByTestId('product-card-title').first()).not.toBeEmpty();
    await expect(page.getByTestId('product-card-price').first()).toContainText('€');
    await expect(cards.first().locator('img')).toHaveAttribute('src', /^https?:\/\//);
  });

  test('pagination pages through different products', async ({ page }) => {
    await page.goto('/shop');
    const titles = page.getByTestId('product-card-title');
    await expect(titles.first()).toBeVisible({ timeout: 20_000 });
    const firstPageFirstTitle = await titles.first().innerText();

    await page.getByRole('button', { name: /next|weiter/i }).click();
    await expect(titles.first()).not.toHaveText(firstPageFirstTitle, { timeout: 20_000 });

    await page.getByRole('button', { name: /previous|zurück/i }).click();
    await expect(titles.first()).toHaveText(firstPageFirstTitle, { timeout: 20_000 });
  });

  test('shows the category navigation', async ({ page }) => {
    await page.goto('/shop');
    await expect(page.getByTestId('category-link').first()).toBeVisible({ timeout: 20_000 });
    expect(await page.getByTestId('category-link').count()).toBeGreaterThan(5);
  });
});
