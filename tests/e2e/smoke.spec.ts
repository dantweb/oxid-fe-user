import { expect, test } from '@playwright/test';

/**
 * Smoke flow against the SDK shop (VITE_SHOP_URL proxied by the dev server):
 * guest browses the catalog, opens a product, fills the cart, changes amounts.
 */
test('guest browses the catalog into the cart', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('home-to-catalog').click();
  await expect(page).toHaveURL(/\/shop$/);

  const firstCard = page.getByTestId('product-card').first();
  await expect(firstCard).toBeVisible({ timeout: 20_000 });
  await firstCard.click();

  await expect(page.getByTestId('product-price')).toBeVisible({ timeout: 20_000 });
  await page.getByTestId('add-to-cart').click();
  await expect(page.getByTestId('added-note')).toBeVisible();

  await page.goto('/shop/cart');
  await expect(page.getByTestId('cart-row')).toHaveCount(1);
  await expect(page.getByTestId('cart-amount')).toHaveText('1');

  await page.getByRole('button', { name: '+' }).click();
  await expect(page.getByTestId('cart-amount')).toHaveText('2');
});

test('login page renders and rejects wrong credentials', async ({ page }) => {
  await page.goto('/login');
  await page.locator('input[name=email]').fill('nobody@example.com');
  await page.locator('input[name=password]').fill('wrong-password');
  await page.getByTestId('login-form').locator('button[type=submit]').click();
  await expect(page.getByTestId('login-error')).toBeVisible({ timeout: 20_000 });
});

test('the document language follows the active locale', async ({ page }) => {
  await page.goto('/');
  const switcher = page.getByTestId('locale-switcher');
  await expect(page.locator('html')).toHaveAttribute('lang', /^(en|de)$/);
  if (await switcher.isVisible().catch(() => false)) {
    await switcher.selectOption({ index: 1 });
    const chosen = await switcher.inputValue();
    await expect(page.locator('html')).toHaveAttribute('lang', chosen);
  }
});
