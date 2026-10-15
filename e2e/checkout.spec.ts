import { expect, test, type Page } from '@playwright/test';

/**
 * Full headless checkout against the SDK shop: a fresh customer registers
 * (API), signs in (UI), fills the cart with an orderable product, completes
 * address + delivery + payment selection and is redirected to the PSP's
 * sandbox. Then the cancel leg retires the attempt. The committed/webhook leg
 * is each payment module's `bin/graph-ql-cli-test.sh pay` territory — the
 * buyer-side approval UI is out of scope here.
 */

test.describe.configure({ mode: 'serial' });

const SHOP_GRAPHQL = 'http://localhost:5173/graphql/'; // dev-server proxy to the shop
const ORDERABLE_PRODUCT = '066e3ce119c43c81cc0e46d4f1681eed'; // "Destiny" (demo data)

const email = `fe-e2e-${Date.now()}@oxid-test.local`;
const password = 'fe-e2e-Pass1!';

test.beforeAll(async ({ request }) => {
  const response = await request.post(SHOP_GRAPHQL, {
    data: {
      query: `mutation { customerRegister(customer: { email: "${email}", password: "${password}" }) { id } }`,
    },
    headers: { 'User-Agent': 'Mozilla/5.0 (playwright)' },
  });
  const body = await response.json();
  expect(body.data.customerRegister.id).toBeTruthy();
});

async function signInAndFillCart(page: Page): Promise<void> {
  await page.goto('/login');
  await page.locator('input[name=email]').fill(email);
  await page.locator('input[name=password]').fill(password);
  await page.getByTestId('login-form').locator('button[type=submit]').click();
  await expect(page.getByTestId('nav-logout')).toBeVisible({ timeout: 20_000 });

  await page.goto(`/shop/product/${ORDERABLE_PRODUCT}`);
  await page.getByTestId('add-to-cart').click();
  await expect(page.getByTestId('added-note')).toBeVisible();
}

test('checkout reaches the PayPal sandbox and cancel retires the attempt', async ({ page }) => {
  await signInAndFillCart(page);

  await page.goto('/shop/cart');
  await page.getByTestId('go-checkout').click();
  await expect(page).toHaveURL(/\/checkout$/);

  // fresh customer → address form
  await page.locator('input[name=firstName]').fill('FE');
  await page.locator('input[name=lastName]').fill('Tester');
  await page.locator('input[name=street]').fill('Bertoldstr');
  await page.locator('input[name=streetNumber]').fill('48');
  await page.locator('input[name=zipCode]').fill('79098');
  await page.locator('input[name=city]').fill('Freiburg');
  await page.getByTestId('save-address').click();

  // single delivery method auto-selects; payments appear
  await expect(page.getByTestId('payment-oe_payments_paypal')).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('payment-oe_payments_paypal').check();
  await page.getByTestId('confirm-terms').check();
  await page.getByTestId('pay-now').click();

  await page.waitForURL(/sandbox\.paypal\.com/, { timeout: 60_000 });

  // back on the storefront: the cancel leg retires the attempt (needs the stored token)
  await page.goto('http://localhost:5173/checkout/cancel/payment-paypal');
  await expect(page.getByTestId('cancel-done')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('cancel-retry')).toBeVisible();
});

test('stripe start reaches the Stripe-hosted checkout', async ({ page }) => {
  await signInAndFillCart(page);

  await page.goto('/checkout');
  await expect(page.getByTestId('address-saved')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('payment-oe_payments_stripe_wallet')).toBeVisible({
    timeout: 30_000,
  });
  await page.getByTestId('payment-oe_payments_stripe_wallet').check();
  await page.getByTestId('confirm-terms').check();
  await page.getByTestId('pay-now').click();

  await page.waitForURL(/checkout\.stripe\.com/, { timeout: 60_000 });

  await page.goto('http://localhost:5173/checkout/cancel/payment-stripe');
  await expect(page.getByTestId('cancel-done')).toBeVisible({ timeout: 30_000 });
});
