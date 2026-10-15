import { expect, test } from '@playwright/test';

test('product page carries title, description, OG and JSON-LD Product', async ({ page }) => {
  await page.goto('/shop');
  await page.getByTestId('product-card').first().click();
  await expect(page.getByTestId('product-price')).toBeVisible({ timeout: 20_000 });

  await expect(page).toHaveTitle(/ · OXID Storefront$/);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /.+/);
  await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'product');

  const jsonLd = page.locator('script[type="application/ld+json"]');
  await expect(jsonLd).toHaveCount(1);
  const data = JSON.parse((await jsonLd.textContent()) ?? '{}');
  expect(data['@type']).toBe('Product');
  expect(data.name.length).toBeGreaterThan(0);
  expect(data.offers.price).toBeGreaterThan(0);
  expect(data.offers.priceCurrency).toBe('EUR');
});

test('cart and login are noindex', async ({ page }) => {
  await page.goto('/shop/cart');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex,nofollow');

  await page.goto('/login');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex,nofollow');
});
