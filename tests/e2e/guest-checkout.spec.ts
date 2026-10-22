import { expect, test } from '@playwright/test';
import { registerCustomer, signIn } from './helpers/session';
import { ORDERABLE_PRODUCT_ID, STRIPE_TEST_CARDS } from './fixtures/test-data';
import { HOSTED_PAYMENTS_CONFIG, withInstanceConfig } from './helpers/config';
import { payOnStripeHostedPage } from './helpers/stripe';

/**
 * Sprint 140c C1 — checkout without an account. A fresh browser context (no login, no stored
 * session) adds a product, opens /checkout and finds a guest form instead of the login page; with
 * e-mail and addresses filled in it pays with a Stripe sandbox card and lands on the success page
 * with its order number. The shop hands the guest an anonymous token (payment-base 1.5, 140a/b).
 */
test.setTimeout(180_000);

const EVIDENCE = 'docs/dev_log/20261022/reports/guest-checkout';

const GUEST = {
  email: () => `guest-e2e-${Date.now()}@oxid-test.local`,
  firstName: 'Gerda',
  lastName: 'Gast',
  street: 'Bertoldstr',
  streetNumber: '48',
  zipCode: '79098',
  city: 'Freiburg',
};

test('a guest pays with Stripe and gets an order number', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'en-US' });
  const page = await context.newPage();
  await withInstanceConfig(page, HOSTED_PAYMENTS_CONFIG);

  await page.goto(`/shop/product/${ORDERABLE_PRODUCT_ID}`);
  await page.getByTestId('add-to-cart').click();
  await expect(page.getByTestId('added-note')).toBeVisible();

  await page.goto('/checkout');
  await expect(page).not.toHaveURL(/\/login/);
  const form = page.getByTestId('guest-form');
  await expect(form).toBeVisible({ timeout: 30_000 });
  await form.locator('input[name=email]').fill(GUEST.email());
  await form.locator('input[name=firstName]').fill(GUEST.firstName);
  await form.locator('input[name=lastName]').fill(GUEST.lastName);
  await form.locator('input[name=street]').fill(GUEST.street);
  await form.locator('input[name=streetNumber]').fill(GUEST.streetNumber);
  await form.locator('input[name=zipCode]').fill(GUEST.zipCode);
  await form.locator('input[name=city]').fill(GUEST.city);

  await page.getByTestId('payment-oe_payments_stripe_wallet').check();
  await page.getByTestId('confirm-terms').check();
  await page.screenshot({ path: `${EVIDENCE}/guest-form-filled.png`, fullPage: true });
  await page.getByTestId('pay-now').click();

  await payOnStripeHostedPage(page, STRIPE_TEST_CARDS.VISA_SUCCESS);

  await page.waitForURL(/\/checkout\/return\/payment-stripe/, { timeout: 90_000 });
  const committed = page.getByTestId('return-committed');
  await expect(committed).toBeVisible({ timeout: 90_000 });
  expect((await committed.innerText()).match(/\d+/)?.[0], 'order number').toBeTruthy();
  expect(new URL(page.url()).search).toBe('');
  await page.screenshot({ path: `${EVIDENCE}/guest-order-confirmed.png` });
  await context.close();
});

async function guestWithCart(
  browser: import('@playwright/test').Browser,
  yaml = HOSTED_PAYMENTS_CONFIG,
) {
  const context = await browser.newContext({ locale: 'en-US' });
  const page = await context.newPage();
  await withInstanceConfig(page, yaml);
  await page.goto(`/shop/product/${ORDERABLE_PRODUCT_ID}`);
  await page.getByTestId('add-to-cart').click();
  await expect(page.getByTestId('added-note')).toBeVisible();
  return { context, page };
}

test('an empty guest form says what is missing and starts nothing', async ({ browser }) => {
  const { context, page } = await guestWithCart(browser);
  let started = false;
  page.on('request', (request) => {
    started ||= (request.postData() ?? '').includes('stripeCheckoutStart');
  });
  await page.goto('/checkout');
  await expect(page.getByTestId('guest-form')).toBeVisible({ timeout: 30_000 });

  await page.getByTestId('payment-oe_payments_stripe_wallet').check();
  await page.getByTestId('confirm-terms').check();
  await page.getByTestId('pay-now').click();

  await expect(page.getByTestId('guest-form').getByRole('alert').first()).toBeVisible();
  await expect(page.getByTestId('guest-form')).toContainText(
    'Please enter a valid e-mail address.',
  );
  expect(started).toBe(false);
  await context.close();
});

test('"deliver to a different address" adds a second address block', async ({ browser }) => {
  const { context, page } = await guestWithCart(browser);
  await page.goto('/checkout');
  await expect(page.getByTestId('guest-form')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('guest-delivery-fields')).toHaveCount(0);

  await page.getByTestId('guest-deliver-elsewhere').check();

  await expect(page.getByTestId('guest-delivery-fields')).toBeVisible();
  await expect(page.locator('input[name=deliveryCity]')).toBeVisible();
  await context.close();
});

test('an e-mail that belongs to an account: translated hint, login link back to the checkout', async ({
  browser,
  request,
}) => {
  const owner = await registerCustomer(request, 'fe-guest-exists');
  const { context, page } = await guestWithCart(browser);
  await page.goto('/checkout');
  const form = page.getByTestId('guest-form');
  await expect(form).toBeVisible({ timeout: 30_000 });
  await form.locator('input[name=email]').fill(owner.email);
  for (const [name, value] of Object.entries({
    firstName: 'Gerda',
    lastName: 'Gast',
    street: 'Bertoldstr',
    streetNumber: '48',
    zipCode: '79098',
    city: 'Freiburg',
  })) {
    await form.locator(`input[name=${name}]`).fill(value);
  }
  await page.getByTestId('payment-oe_payments_stripe_wallet').check();
  await page.getByTestId('confirm-terms').check();

  await page.getByTestId('pay-now').click();

  await expect(page.getByTestId('checkout-error')).toContainText(
    'An account with this e-mail address already exists',
    { timeout: 30_000 },
  );
  await page.screenshot({ path: `${EVIDENCE}/guest-account-exists.png`, fullPage: true });
  await page.getByTestId('guest-login-link').click();
  await expect(page).toHaveURL(/\/login\?redirect=\/checkout/);
  await page.locator('input[name=email]').fill(owner.email);
  await page.locator('input[name=password]').fill(owner.password);
  await page.getByTestId('login-form').locator('button[type=submit]').click();
  await expect(page.getByTestId('address-form')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('guest-form')).toHaveCount(0);
  await context.close();
});

test('a logged-in shopper never sees the guest form', async ({ page, request }) => {
  await withInstanceConfig(page, HOSTED_PAYMENTS_CONFIG);
  await signIn(page, await registerCustomer(request, 'fe-guest-loggedin'));
  await page.goto(`/shop/product/${ORDERABLE_PRODUCT_ID}`);
  await page.getByTestId('add-to-cart').click();
  await expect(page.getByTestId('added-note')).toBeVisible();

  await page.goto('/checkout');

  await expect(page.getByTestId('address-form')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('guest-form')).toHaveCount(0);
});

test('with checkout.guest: false the checkout still sends a guest to the login', async ({
  browser,
}) => {
  const { context, page } = await guestWithCart(
    browser,
    `${HOSTED_PAYMENTS_CONFIG}checkout: { guest: false }\n`,
  );

  await page.goto('/checkout');

  await expect(page).toHaveURL(/\/login\?redirect=\/checkout/);
  await expect(page.getByTestId('guest-form')).toHaveCount(0);
  await context.close();
});

test('the return page of a guest also works without a customer session', async ({ browser }) => {
  const { context, page } = await guestWithCart(browser);
  await page.goto('/checkout/cancel/payment-stripe');

  await expect(page.getByTestId('cancel-done')).toBeVisible();
  await expect(page).not.toHaveURL(/\/login/);
  await context.close();
});

test('the guest form fits a phone: no horizontal scroll, tap targets of 44 px', async ({
  browser,
}) => {
  const { context, page } = await guestWithCart(browser);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/checkout');
  await expect(page.getByTestId('guest-form')).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('guest-deliver-elsewhere').check();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  const heights = await page
    .locator('[data-testid=guest-form] input:not([type=checkbox]), [data-testid=guest-form] select')
    .evaluateAll((fields) => fields.map((field) => field.getBoundingClientRect().height));
  expect(Math.min(...heights)).toBeGreaterThanOrEqual(44);
  await page.screenshot({ path: `${EVIDENCE}/guest-form-phone.png`, fullPage: true });
  await context.close();
});
