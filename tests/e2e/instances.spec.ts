import { expect, test, type Page } from '@playwright/test';
import { CAPS_CATEGORY_ID, ORDERABLE_PRODUCT_ID } from './fixtures/test-data';
import { registerCustomer, signIn } from './helpers/session';

/**
 * One compiled image, two instance folders (instances/example-a, instances/example-b):
 * the two deployments must be visibly different shops. Run with both containers up:
 *   E2E_INSTANCE_A_URL=http://localhost:8090 E2E_INSTANCE_B_URL=http://localhost:8091 npx playwright test instances
 */
const A = process.env.E2E_INSTANCE_A_URL;
const B = process.env.E2E_INSTANCE_B_URL;

test.skip(!A || !B, 'set E2E_INSTANCE_A_URL and E2E_INSTANCE_B_URL to run the instance proof');

async function openCheckoutPayments(
  page: Page,
  request: Parameters<typeof registerCustomer>[0],
  baseUrl: string,
): Promise<void> {
  const user = await registerCustomer(request, 'fe-inst', baseUrl);
  await signIn(page, user);
  await page.goto(`/shop/product/${ORDERABLE_PRODUCT_ID}`);
  await page.locator('[data-testid="add-to-cart"]').click();
  await page.goto('/checkout');
  await page.locator('input[name=firstName]').fill('Inst');
  await page.locator('input[name=lastName]').fill('Tester');
  await page.locator('input[name=street]').fill('Bertoldstr');
  await page.locator('input[name=streetNumber]').fill('48');
  await page.locator('input[name=zipCode]').fill('79098');
  await page.locator('input[name=city]').fill('Freiburg');
  await page.getByTestId('save-address').click();
  await expect(page.getByTestId('payment-oe_payments_stripe_wallet')).toBeVisible({
    timeout: 30_000,
  });
}

test.describe('instance A — the defaults', () => {
  test.use({ baseURL: A });

  test('shop name, two languages, 12 products per page, indexable', async ({ page, request }) => {
    await page.goto('/');
    await expect(page.locator('.header__brand')).toHaveText('OXID Storefront');
    await expect(page.getByTestId('locale-switcher')).toBeVisible();
    await expect(page.getByTestId('locale-switcher').locator('option')).toHaveCount(2);

    await page.goto('/shop');
    await expect(page.getByTestId('product-card')).toHaveCount(12, { timeout: 20_000 });
    await expect(page.getByRole('link', { name: /Mützen-Angebote|Cap deals/ })).toHaveCount(0);

    const robots = await (await request.get('/robots.txt')).text();
    expect(robots).toContain('Allow: /');
    expect(robots).toContain('Disallow: /dashboard');
  });

  test('offers PayPal, Stripe and Mollie at checkout', async ({ page, request }) => {
    await openCheckoutPayments(page, request, A!);
    await expect(page.getByTestId('payment-oe_payments_paypal')).toBeVisible();
    await expect(page.getByTestId('payment-oe_payments_mollie')).toBeVisible();
  });
});

test.describe('instance B — same bundle, its own configuration', () => {
  test.use({ baseURL: B });

  test('other shop name, German only (no switcher), 6 products per page', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.header__brand')).toHaveText('Shop Zwei');
    await expect(page).toHaveTitle(/Shop Zwei/);
    await expect(page.getByTestId('nav-login')).toHaveText('Anmelden');
    await expect(page.getByTestId('locale-switcher')).toHaveCount(0);

    await page.goto('/shop');
    await expect(page.getByTestId('product-card')).toHaveCount(6, { timeout: 20_000 });
  });

  test('public/ overlay: its own robots.txt wins over the bundle’s', async ({ request }) => {
    const robots = await (await request.get('/robots.txt')).text();
    expect(robots).toContain('Disallow: /');
    expect(robots).not.toContain('Allow: /');
  });

  test('plugins/ folder: the external promo plugin adds a navigation entry', async ({ page }) => {
    await page.goto('/');
    const promo = page.getByRole('link', { name: 'Mützen-Angebote' });
    await expect(promo).toBeVisible({ timeout: 20_000 });
    await promo.click();
    await expect(page).toHaveURL(new RegExp(`/shop/category/${CAPS_CATEGORY_ID}$`));
    await expect(page.getByTestId('category-title')).toHaveText('Caps', { timeout: 20_000 });
  });

  test('plugin set: Stripe only — PayPal and Mollie are not offered at checkout', async ({
    page,
    request,
  }) => {
    await openCheckoutPayments(page, request, B!);
    await expect(page.getByTestId('payment-oe_payments_paypal')).toHaveCount(0);
    await expect(page.getByTestId('payment-oe_payments_mollie')).toHaveCount(0);
  });

  test('serves its own oxid-config.yaml', async ({ request }) => {
    const yaml = await (await request.get('/oxid-config.yaml')).text();
    expect(yaml).toContain('id: example-b');
    expect(yaml).toContain('name: Shop Zwei');
  });
});
