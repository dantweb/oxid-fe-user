import { expect, test, type FrameLocator, type Page } from '@playwright/test';
import { withInstanceConfig } from './helpers/config';
import {
  confirmTerms,
  expectCommittedOrder,
  expectOrderInDashboard,
  openPaymentStep,
} from './helpers/checkout';
import { STRIPE_CARD_DETAILS, STRIPE_TEST_CARDS } from './fixtures/test-data';

/**
 * Stripe in iframe mode: Stripe's Embedded Checkout renders INSIDE the checkout page (no redirect
 * until Stripe finishes), like the standard checkout's iframe mode.
 */
test.describe.configure({ mode: 'serial' });
test.setTimeout(180_000);

const embedded = (page: Page): FrameLocator =>
  page.frameLocator('iframe[name="embedded-checkout"]');

async function payInEmbeddedCheckout(page: Page, card: string): Promise<void> {
  const frame = embedded(page);
  const email = frame.getByRole('textbox', { name: 'Email' });
  await email.waitFor({ state: 'visible', timeout: 60_000 });
  // unique per session: a returning email makes Stripe offer Link instead of the plain card form
  await email.fill(`stripe-iframe-${Date.now()}@oxid-test.local`);
  await frame.getByText('Card', { exact: true }).first().click({ force: true });
  await frame.locator('#cardNumber').fill(card);
  await frame.locator('#cardExpiry').fill(STRIPE_CARD_DETAILS.expiry);
  await frame.locator('#cardCvc').fill(STRIPE_CARD_DETAILS.cvc);
  await frame.locator('#billingName').fill(STRIPE_CARD_DETAILS.name);
  await frame.locator('[data-testid="hosted-payment-submit-button"]').first().click();
}

test('the payment form appears inline once the terms are confirmed — no redirect, no Pay-now button', async ({
  page,
}) => {
  await openPaymentStep(page, 'stripe');

  // before the terms: a hint, nothing mounted
  await expect(page.getByTestId('inline-hint')).toBeVisible();
  await expect(page.locator('iframe[name="embedded-checkout"]')).toHaveCount(0);

  await confirmTerms(page);
  await expect(page.locator('iframe[name="embedded-checkout"]')).toHaveCount(1, {
    timeout: 60_000,
  });
  await expect(embedded(page).getByRole('textbox', { name: 'Email' })).toBeVisible({
    timeout: 60_000,
  });
  await expect(page).toHaveURL(/\/checkout$/); // the shopper is still on the checkout page
  await expect(page.getByTestId('pay-now')).toHaveCount(0);
  await expect(page.getByTestId('inline-hint')).toHaveCount(0);
});

test('paying in the embedded form commits the order (Stripe test card)', async ({ page }) => {
  await openPaymentStep(page, 'stripe');
  await confirmTerms(page);
  await payInEmbeddedCheckout(page, STRIPE_TEST_CARDS.VISA_SUCCESS);

  const orderNumber = await expectCommittedOrder(page, 'payment-stripe');
  await expectOrderInDashboard(page, orderNumber); // manual capture: authorized = open
});

test('a declined card shows Stripe’s message inside the form and a good card then succeeds', async ({
  page,
}) => {
  await openPaymentStep(page, 'stripe');
  await confirmTerms(page);
  await payInEmbeddedCheckout(page, STRIPE_TEST_CARDS.CARD_DECLINED);

  await expect(
    embedded(page)
      .getByText(/card was declined/i)
      .first(),
  ).toBeVisible({ timeout: 40_000 });
  await expect(page).toHaveURL(/\/checkout$/);

  const frame = embedded(page);
  await frame.locator('#cardNumber').fill(STRIPE_TEST_CARDS.VISA_SUCCESS);
  await frame.locator('#cardExpiry').fill(STRIPE_CARD_DETAILS.expiry);
  await frame.locator('#cardCvc').fill(STRIPE_CARD_DETAILS.cvc);
  await frame.locator('[data-testid="hosted-payment-submit-button"]').first().click();

  const orderNumber = await expectCommittedOrder(page, 'payment-stripe');
  await expectOrderInDashboard(page, orderNumber);
});

test('changing your mind retires the attempt: un-ticking and re-ticking the terms mounts a fresh form', async ({
  page,
}) => {
  await openPaymentStep(page, 'stripe');
  await confirmTerms(page);
  await expect(page.locator('iframe[name="embedded-checkout"]')).toHaveCount(1, {
    timeout: 60_000,
  });

  await page.getByTestId('confirm-terms').uncheck();
  await expect(page.locator('iframe[name="embedded-checkout"]')).toHaveCount(0);
  await expect(page.getByTestId('inline-hint')).toBeVisible();

  await confirmTerms(page);
  await expect(page.locator('iframe[name="embedded-checkout"]')).toHaveCount(1, {
    timeout: 60_000,
  });
  await expect(embedded(page).getByRole('textbox', { name: 'Email' })).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByTestId('checkout-error')).toHaveCount(0); // no "order already exists"
});

test('mode: redirect falls back to the hosted Stripe page', async ({ page }) => {
  await withInstanceConfig(
    page,
    'plugins:\n  shop: {}\n  checkout: {}\n  dashboard: {}\n  payment-stripe:\n    config:\n      mode: redirect\n',
  );
  await openPaymentStep(page, 'stripe');
  await confirmTerms(page);

  await expect(page.locator('iframe[name="embedded-checkout"]')).toHaveCount(0);
  await page.getByTestId('pay-now').click();
  await page.waitForURL(/checkout\.stripe\.com/, { timeout: 60_000 });
});
