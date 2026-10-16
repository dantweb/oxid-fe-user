import { expect, type FrameLocator, type Page } from '@playwright/test';

export const PAYPAL_BUYER = {
  email: process.env.PAYPAL_BUYER_EMAIL ?? '',
  password: process.env.PAYPAL_BUYER_PASSWORD ?? '',
};

export const paypalButtons = (page: Page): FrameLocator =>
  page.frameLocator('iframe[name^="__zoid__paypal_buttons"]').first();

/**
 * Clicks PayPal's own button in the Smart Buttons iframe and returns the approval popup. The SDK
 * attaches its click handlers shortly after rendering, so the click waits a moment first.
 */
export async function openPayPalPopup(page: Page): Promise<Page> {
  const link = paypalButtons(page).getByRole('link', { name: 'PayPal', exact: true }).first();
  await link.waitFor({ state: 'visible', timeout: 60_000 });
  await page.waitForTimeout(1_500);
  const popup = page.waitForEvent('popup', { timeout: 60_000 });
  await link.click();
  return popup;
}

/** Logs the sandbox buyer in on PayPal's page (popup or redirect) and approves the payment. */
export async function approveInPayPalSandbox(paypal: Page): Promise<void> {
  const email = paypal.locator('#email, input[name="login_email"], input[type="email"]').first();
  await email.waitFor({ state: 'visible', timeout: 60_000 });
  await email.fill(PAYPAL_BUYER.email);
  await email.press('Enter');

  // PayPal's SPA keeps one URL; the "Change" link beside the email marks the password screen
  await paypal
    .locator('a, button')
    .filter({ hasText: /^(Change|Ändern)$/ })
    .first()
    .waitFor({ state: 'visible', timeout: 30_000 });
  const password = paypal
    .locator('#password, input[name="login_password"], input[type="password"]')
    .first();
  await password.waitFor({ state: 'visible', timeout: 15_000 });
  await password.fill(PAYPAL_BUYER.password);
  await paypal
    .locator('button')
    .filter({ hasText: /^(Log In|Anmelden)$/ })
    .first()
    .click({ timeout: 10_000 })
    .catch(() => password.press('Enter'));

  // the approval screen: a button like "Pay €80.95" / "Jetzt zahlen"; the popup closes after it
  for (let attempt = 0; attempt < 15 && !paypal.isClosed(); attempt += 1) {
    await paypal.waitForTimeout(2_000).catch(() => undefined);
    if (paypal.isClosed()) {
      break;
    }
    const pay = paypal
      .getByRole('button', {
        name: /^(Pay|Pay now|Jetzt zahlen|Zahlen|Complete purchase|Continue|Weiter)(\s+[\d€$£.,\s]+)?$/i,
      })
      .first();
    if ((await pay.count()) > 0 && (await pay.isVisible().catch(() => false))) {
      await pay.click({ timeout: 5_000 }).catch(() => undefined);
    }
  }
  expect(
    paypal.isClosed() || !paypal.url().includes('paypal.com'),
    'PayPal approval finished',
  ).toBe(true);
}
