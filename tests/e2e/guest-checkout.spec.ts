import { expect, test } from '@playwright/test';
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
  await page.getByTestId('pay-now').click();

  await payOnStripeHostedPage(page, STRIPE_TEST_CARDS.VISA_SUCCESS);

  await page.waitForURL(/\/checkout\/return\/payment-stripe/, { timeout: 90_000 });
  const committed = page.getByTestId('return-committed');
  await expect(committed).toBeVisible({ timeout: 90_000 });
  expect((await committed.innerText()).match(/\d+/)?.[0], 'order number').toBeTruthy();
  expect(new URL(page.url()).search).toBe('');
  await context.close();
});
