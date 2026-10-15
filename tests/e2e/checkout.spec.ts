import { expect, test, type Page } from '@playwright/test';
import { registerCustomer, signIn, type Credentials } from './helpers/session';

/**
 * Full headless checkout against the SDK shop: a fresh customer registers
 * (API), signs in (UI), fills the cart with an orderable product, completes
 * address + delivery + payment selection and is redirected to the PSP's
 * sandbox. Then the cancel leg retires the attempt. The committed/webhook leg
 * is each payment module's `bin/graph-ql-cli-test.sh pay` territory — the
 * buyer-side approval UI is out of scope here.
 */

test.describe.configure({ mode: 'serial' });

const ORDERABLE_PRODUCT = '066e3ce119c43c81cc0e46d4f1681eed'; // "Destiny" (demo data)

let user: Credentials;

test.beforeAll(async ({ request }) => {
  user = await registerCustomer(request, 'fe-e2e');
});

async function signInAndFillCart(page: Page): Promise<void> {
  await signIn(page, user);

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
  await page.goto('/checkout/cancel/payment-paypal');
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

  await page.goto('/checkout/cancel/payment-stripe');
  await expect(page.getByTestId('cancel-done')).toBeVisible({ timeout: 30_000 });
});
