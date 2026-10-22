import { test } from '@playwright/test';
import { confirmTerms, openPaymentStep } from './helpers/checkout';
import { paypalButtons } from './helpers/paypal';
import { TEST_USER_CONFIGURED, TEST_USER_MISSING } from './fixtures/test-data';

test.skip(!TEST_USER_CONFIGURED, TEST_USER_MISSING);

/** Evidence for docs/dev_log/20261016/reports/payments: each method's inline UI on the checkout page. */
const OUT = 'docs/dev_log/20261016/reports/payments';
test.setTimeout(120_000);
test.use({ viewport: { width: 1280, height: 1400 } });

test('stripe inline', async ({ page }) => {
  await openPaymentStep(page, 'stripe');
  await confirmTerms(page);
  await page
    .frameLocator('iframe[name="embedded-checkout"]')
    .getByRole('textbox', { name: 'Email' })
    .waitFor({ timeout: 60_000 });
  await page.screenshot({ path: `${OUT}/stripe-inline.png` });
});

test('paypal inline', async ({ page }) => {
  await openPaymentStep(page, 'paypal');
  await confirmTerms(page);
  await paypalButtons(page)
    .getByRole('link', { name: 'PayPal', exact: true })
    .first()
    .waitFor({ timeout: 60_000 });
  await page.screenshot({ path: `${OUT}/paypal-inline.png` });
});

test('mollie inline', async ({ page }) => {
  await openPaymentStep(page, 'mollie');
  await confirmTerms(page);
  await page.getByTestId('mollie-pay').waitFor({ timeout: 60_000 });
  await page.getByTestId('mollie-verificationCode').scrollIntoViewIfNeeded();
  await page.waitForTimeout(3_000);
  await page.screenshot({ path: `${OUT}/mollie-inline.png` });
});
