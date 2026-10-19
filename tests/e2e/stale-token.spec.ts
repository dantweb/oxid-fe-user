import { expect, test, type Page } from '@playwright/test';
import { fillLogin, registerCustomer } from './helpers/session';

/**
 * Sprint 14: a token the shop refuses (signing key changed, other environment on the same origin,
 * database reset) must heal itself. The shop checks the Authorization header BEFORE it reads the
 * query, so a stale token used to block even the login that replaces it.
 */
const base64url = (value: object): string =>
  Buffer.from(JSON.stringify(value)).toString('base64url');

/** Well-formed and not expired — so the client trusts it — but signed by nobody. */
const FORGED = [
  base64url({ alg: 'HS256', typ: 'JWT' }),
  base64url({ exp: Math.floor(Date.now() / 1000) + 3600, useranonymous: false, username: 'ghost' }),
  'forged-signature',
].join('.');

async function seedStaleToken(page: Page): Promise<void> {
  await page.addInitScript((token) => localStorage.setItem('oxfe.token', token), FORGED);
}

const storedToken = (page: Page): Promise<string | null> =>
  page.evaluate(() => localStorage.getItem('oxfe.token'));

test.describe('a stale access token', () => {
  test('does not stop the storefront from loading products', async ({ page }) => {
    await seedStaleToken(page);

    await page.goto('/shop');

    await expect(page.getByTestId('product-card').first()).toBeVisible({ timeout: 20_000 });
    await expect.poll(() => storedToken(page)).not.toBe(FORGED);
  });

  test('does not stop the login that replaces it', async ({ page, request }) => {
    const customer = await registerCustomer(request, 'fe-stale');
    await seedStaleToken(page);

    await page.goto('/login');
    await fillLogin(page, customer);

    const token = await storedToken(page);
    expect(token).not.toBeNull();
    expect(token).not.toBe(FORGED);
    const payload = JSON.parse(Buffer.from(token!.split('.')[1], 'base64url').toString());
    expect(payload.useranonymous).toBe(false);
  });

  test('garbage in storage is dropped and the page still works', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('oxfe.token', 'not-a-jwt'));

    await page.goto('/shop');

    await expect(page.getByTestId('product-card').first()).toBeVisible({ timeout: 20_000 });
    await expect.poll(() => storedToken(page)).not.toBe('not-a-jwt');
  });
});
