import { expect, test } from '@playwright/test';
import { withInstanceConfig } from './helpers/config';
import {
  confirmTerms,
  expectCommittedOrder,
  expectOrderInDashboard,
  openPaymentStep,
} from './helpers/checkout';
import {
  approveInPayPalSandbox,
  openPayPalPopup,
  PAYPAL_BUYER,
  paypalButtons,
} from './helpers/paypal';

/**
 * PayPal in iframe mode: Smart Buttons on the checkout page; the approval happens in PayPal's popup,
 * the shopper never leaves the checkout page until PayPal has approved.
 */
test.describe.configure({ mode: 'serial' });
test.setTimeout(240_000);
test.skip(!PAYPAL_BUYER.email, 'set PAYPAL_BUYER_EMAIL / PAYPAL_BUYER_PASSWORD (tests/e2e/.env)');

const BUTTON_FRAME = 'iframe[name^="__zoid__paypal_buttons"]';

test('Smart Buttons render inline once the terms are confirmed — no redirect, no Pay-now button', async ({
  page,
}) => {
  await openPaymentStep(page, 'paypal');
  await expect(page.getByTestId('inline-hint')).toBeVisible();
  await expect(page.locator(BUTTON_FRAME)).toHaveCount(0);

  await confirmTerms(page);
  await expect(page.locator(BUTTON_FRAME).first()).toBeVisible({ timeout: 60_000 });
  await expect(paypalButtons(page).locator('[data-funding-source="paypal"]').first()).toBeVisible({
    timeout: 60_000,
  });
  await expect(page).toHaveURL(/\/checkout$/);
  await expect(page.getByTestId('pay-now')).toHaveCount(0);
});

test('approving in the PayPal popup commits and captures the order (automatic capture: paid)', async ({
  page,
}) => {
  await openPaymentStep(page, 'paypal');
  await confirmTerms(page);
  await expect(paypalButtons(page).locator('[data-funding-source="paypal"]').first()).toBeVisible({
    timeout: 60_000,
  });

  await approveInPayPalSandbox(await openPayPalPopup(page));

  const orderNumber = await expectCommittedOrder(page, 'payment-paypal');
  await expectOrderInDashboard(page, orderNumber, /paid|bezahlt/i);
});

test('closing the popup cancels: the attempt is retired and the buttons work again', async ({
  page,
}) => {
  await openPaymentStep(page, 'paypal');
  await confirmTerms(page);
  await expect(paypalButtons(page).locator('[data-funding-source="paypal"]').first()).toBeVisible({
    timeout: 60_000,
  });

  const paypal = await openPayPalPopup(page);
  await paypal.locator('#email, input[type="email"]').first().waitFor({ timeout: 60_000 });
  // cancelling retires the attempt and rebuilds a fresh basket: wait for that to finish
  const rebuilt = page.waitForResponse(
    (response) =>
      response.url().includes('graphql') &&
      (response.request().postData() ?? '').includes('checkoutPayments'),
    { timeout: 60_000 },
  );
  await paypal.close();
  await rebuilt;

  // still on the checkout page, no error, and the buttons are there for another try
  await expect(page).toHaveURL(/\/checkout$/);
  await expect(page.getByTestId('checkout-error')).toHaveCount(0);
  await expect(paypalButtons(page).locator('[data-funding-source="paypal"]').first()).toBeVisible({
    timeout: 60_000,
  });
  const again = await openPayPalPopup(page);
  await again.locator('#email, input[type="email"]').first().waitFor({ timeout: 60_000 });
  await again.close();
});

test('mode: redirect falls back to the hosted PayPal approval page', async ({ page }) => {
  await withInstanceConfig(
    page,
    'plugins:\n  shop: {}\n  checkout: {}\n  dashboard: {}\n  payment-paypal:\n    config:\n      mode: redirect\n',
  );
  await openPaymentStep(page, 'paypal');
  await confirmTerms(page);

  await expect(page.locator(BUTTON_FRAME)).toHaveCount(0);
  await page.getByTestId('pay-now').click();
  await page.waitForURL(/paypal\.com/, { timeout: 60_000 });
});
