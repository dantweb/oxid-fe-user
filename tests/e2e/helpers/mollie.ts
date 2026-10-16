import { expect, type Page } from '@playwright/test';

export type MollieTestStatus = 'Open' | 'Authorized' | 'Paid' | 'Failed' | 'Expired' | 'Canceled';

/** Mollie Components load lazily: a field is only live once it is on screen. */
export async function fillCardFields(
  page: Page,
  card: { holder: string; number: string; expiry: string; cvc: string },
): Promise<void> {
  const fields = [
    ['cardHolder', card.holder],
    ['cardNumber', card.number],
    ['expiryDate', card.expiry],
    ['verificationCode', card.cvc],
  ] as const;
  for (const [name, value] of fields) {
    await page.getByTestId(`mollie-${name}`).scrollIntoViewIfNeeded();
    await page
      .frameLocator(`iframe[name="${name}-input"]`)
      .locator(`#${name}`)
      .fill(value, { timeout: 30_000 });
  }
}

/** Mollie's test-mode page: pick the final status of the test payment and continue to the shop. */
export async function finishOnMollieTestPage(page: Page, status: MollieTestStatus): Promise<void> {
  await page.waitForURL(/mollie\.com\/checkout\//, { timeout: 60_000 });
  // iDEAL asks for the bank first; cards and the other methods go straight to the status page
  const bank = page.getByRole('button', { name: /\bING\b/ });
  const radio = page.getByRole('radio', { name: status, exact: true });
  await bank.or(radio).first().waitFor({ timeout: 30_000 });
  if (await bank.isVisible()) {
    await bank.click();
  }
  await page.getByRole('radio', { name: status, exact: true }).check();
  await page.getByRole('button', { name: /continue/i }).click();
}

export const expectMollieMethod = (page: Page, method: string) =>
  expect(page).toHaveURL(new RegExp(`method=${method}`));
