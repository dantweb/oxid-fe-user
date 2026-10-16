import { expect, test, type Page } from '@playwright/test';
import { CAPS_CATEGORY_ID, ORDERABLE_PRODUCT_ID } from './fixtures/test-data';
import { deployedConfig, productsPerPage, shopName } from './helpers/instance-config';
import { registerCustomer, signIn } from './helpers/session';

/**
 * One compiled image, two instance folders (the deployed oxid-config.yaml, instances/example-b):
 * the two deployments must be visibly different shops. Run with both containers up:
 *   E2E_INSTANCE_A_URL=http://localhost:8090 E2E_INSTANCE_B_URL=http://localhost:8091 npx playwright test instances
 */
const A = process.env.E2E_INSTANCE_A_URL;
const B = process.env.E2E_INSTANCE_B_URL;
const C = process.env.E2E_INSTANCE_C_URL;

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

test.describe('instance A — the deployed oxid-config.yaml', () => {
  test.use({ baseURL: A });

  test('shop name, languages and page size from its config, indexable', async ({
    page,
    request,
  }) => {
    await page.goto('/');
    await expect(page.locator('.header__brand')).toHaveText(shopName());
    await expect(page.getByTestId('locale-switcher')).toBeVisible();
    await expect(page.getByTestId('locale-switcher').locator('option')).toHaveCount(
      deployedConfig().i18n.locales.length,
    );

    await page.goto('/shop');
    await expect(page.getByTestId('product-card')).toHaveCount(productsPerPage(), {
      timeout: 20_000,
    });
    await expect(page.getByRole('link', { name: /Mützen-Angebote|Cap deals/ })).toHaveCount(0);

    const robots = await (await request.get('/robots.txt')).text();
    expect(robots).toContain('Allow: /');
    expect(robots).toContain('Disallow: /dashboard');
  });

  test('runs the default theme', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('home-hero')).toBeVisible();
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(
      'rgb(255, 255, 255)',
    );
    await expect(page.getByTestId('theme-logo')).toHaveAttribute(
      'src',
      /\/themes\/default\/images\/logo\.png/,
    );
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

  test('runs the dark child theme from its config', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('home-hero')).toBeVisible();
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(
      'rgb(18, 18, 18)',
    );
    await expect(page.getByTestId('theme-logo')).toHaveAttribute(
      'src',
      /\/themes\/dark\/images\/logo-dark\.png/,
    );
  });

  test('serves its own oxid-config.yaml', async ({ request }) => {
    const yaml = await (await request.get('/oxid-config.yaml')).text();
    expect(yaml).toContain('id: example-b');
    expect(yaml).toContain('name: Shop Zwei');
  });
});

test.describe('instance C — the peroxid layout plugin from its own config', () => {
  test.skip(!C, 'set E2E_INSTANCE_C_URL to run the peroxid instance proof');
  test.use({ baseURL: C });

  test('the layout plugin and its default theme apply with no explicit theme', async ({ page }) => {
    await page.goto('/');

    // layout: header, hero, three streams, footer from the plugin; the defaults are gone
    await expect(page.getByTestId('pxd-header')).toBeVisible();
    await expect(page.getByTestId('pxd-hero')).toBeVisible();
    await expect(page.getByTestId('pxd-rail-title')).toHaveCount(3, { timeout: 20_000 });
    await expect(page.getByTestId('pxd-footer')).toBeVisible();
    await expect(page.locator('.header__brand')).toHaveCount(0);

    // look: the instance names no theme, so the plugin's defaultTheme (peroxid) is what runs
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(
      'rgb(251, 249, 246)',
    );
    await expect(page.locator('#oxfe-theme-css')).toHaveAttribute('href', /\/themes\/peroxid\//);
  });

  test('the other two instances are untouched by the plugin', async ({ browser }) => {
    for (const url of [A!, B!]) {
      const context = await browser.newContext({ baseURL: url });
      const page = await context.newPage();
      await page.goto('/');
      await expect(page.getByTestId('home-hero')).toBeVisible();
      await expect(page.getByTestId('pxd-header')).toHaveCount(0);
      await context.close();
    }
  });
});
