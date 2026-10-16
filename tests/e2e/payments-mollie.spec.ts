import { expect, test } from '@playwright/test';
import { withInstanceConfig } from './helpers/config';
import {
  confirmTerms,
  expectCommittedOrder,
  expectOrderInDashboard,
  openPaymentStep,
} from './helpers/checkout';
import { fillCardFields, finishOnMollieTestPage } from './helpers/mollie';

/**
 * Mollie in iframe mode: Mollie Components render the card fields INSIDE the checkout page (four
 * Mollie iframes). In test mode Mollie then shows its test-payment page where the final status is
 * picked; other methods (iDEAL, …) pre-select the method and continue on Mollie's page.
 * Capture mode of this shop is manual: an authorized payment is an open order.
 */
test.describe.configure({ mode: 'serial' });
test.setTimeout(180_000);

const CARD = {
  holder: 'Test Buyer',
  number: '4543474002249996',
  expiry: '1230',
  cvc: '123',
};
const FIELD_FRAMES = ['cardHolder', 'cardNumber', 'expiryDate', 'verificationCode'];

test('Mollie Components render inline once the terms are confirmed — four iframes, no redirect', async ({
  page,
}) => {
  await openPaymentStep(page, 'mollie');
  await expect(page.getByTestId('inline-hint')).toBeVisible();
  await expect(page.getByTestId('mollie-inline')).toHaveCount(0);

  await confirmTerms(page);
  await expect(page.getByTestId('mollie-pay')).toBeVisible({ timeout: 60_000 });
  for (const name of FIELD_FRAMES) {
    await expect(page.locator(`iframe[name="${name}-input"]`)).toHaveCount(1, { timeout: 30_000 });
  }
  await expect(page).toHaveURL(/\/checkout$/);
  await expect(page.getByTestId('pay-now')).toHaveCount(0);
  await expect(page.getByTestId('mollie-method-ideal')).toBeVisible();
});

test('paying by card: token from the iframes → Mollie test page → authorized → committed order', async ({
  page,
}) => {
  await openPaymentStep(page, 'mollie');
  await confirmTerms(page);
  await expect(page.getByTestId('mollie-pay')).toBeVisible({ timeout: 60_000 });
  await fillCardFields(page, CARD);
  await page.getByTestId('mollie-pay').click();

  await finishOnMollieTestPage(page, 'Authorized');
  const orderNumber = await expectCommittedOrder(page, 'payment-mollie');
  await expectOrderInDashboard(page, orderNumber); // manual capture: authorized = open
});

test('a failed card payment commits no order and the shopper can start over', async ({ page }) => {
  await openPaymentStep(page, 'mollie');
  await confirmTerms(page);
  await expect(page.getByTestId('mollie-pay')).toBeVisible({ timeout: 60_000 });
  await fillCardFields(page, CARD);
  await page.getByTestId('mollie-pay').click();

  await finishOnMollieTestPage(page, 'Failed');
  await page.waitForURL(/\/checkout\/return\/payment-mollie/, { timeout: 60_000 });
  await expect(page.getByTestId('return-failed')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId('return-committed')).toHaveCount(0);

  // starting over works: a fresh checkout pays
  await openPaymentStep(page, 'mollie');
  await confirmTerms(page);
  await expect(page.getByTestId('mollie-pay')).toBeVisible({ timeout: 60_000 });
  await fillCardFields(page, CARD);
  await page.getByTestId('mollie-pay').click();
  await finishOnMollieTestPage(page, 'Authorized');
  await expectCommittedOrder(page, 'payment-mollie');
});

test('another method (iDEAL) is chosen inline and continues on Mollie’s page → committed order', async ({
  page,
}) => {
  await openPaymentStep(page, 'mollie');
  await confirmTerms(page);
  await expect(page.getByTestId('mollie-pay')).toBeVisible({ timeout: 60_000 });
  await page.getByTestId('mollie-method-ideal').check();
  await expect(page.getByTestId('mollie-card')).toBeHidden();
  await page.getByTestId('mollie-pay').click();

  await finishOnMollieTestPage(page, 'Paid');
  const orderNumber = await expectCommittedOrder(page, 'payment-mollie');
  await expectOrderInDashboard(page, orderNumber); // iDEAL cannot be authorized-only: paid
});

test('mode: redirect falls back to Mollie’s hosted page', async ({ page }) => {
  await withInstanceConfig(
    page,
    'plugins:\n  shop: {}\n  checkout: {}\n  dashboard: {}\n  payment-mollie:\n    config:\n      mode: redirect\n',
  );
  await openPaymentStep(page, 'mollie');
  await confirmTerms(page);

  await expect(page.getByTestId('mollie-inline')).toHaveCount(0);
  await page.getByTestId('pay-now').click();
  await page.waitForURL(/mollie\.com/, { timeout: 60_000 });
});
