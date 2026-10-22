import { expect, test, type Page } from '@playwright/test';
import { withInstanceConfig } from './helpers/config';

/**
 * Sprint 138f: the shopper sees translated text for a failure, never the shop's own message. The
 * shop is scripted here (a refused login with an English, URL-bearing message); the developer
 * details block appears only on an instance that sets `debug.errors: true`.
 */
const RAW = 'Leaked shop text from https://internal.example/secret-path';

async function refuseLogins(page: Page): Promise<void> {
  await page.route('**/graphql/**', async (route) => {
    const body = route.request().postData() ?? '';
    if (!/\blogin\s*\(/.test(body)) {
      return route.continue();
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: null,
        errors: [{ message: RAW, extensions: { errorCode: 'invalid_login' } }],
      }),
    });
  });
}

async function failedLogin(page: Page, yaml: string): Promise<void> {
  await withInstanceConfig(page, yaml);
  await refuseLogins(page);
  await page.goto('/login');
  await page.locator('input[name=email]').fill('nobody@example.com');
  await page.locator('input[name=password]').fill('wrong-password');
  await page.getByRole('button', { name: /sign in|anmelden/i }).click();
  await expect(page.getByTestId('login-error')).toBeVisible();
}

const ENGLISH = 'i18n: { default_locale: en, fallback_locale: en, locales: [en] }\n';

test('a refused login shows the translated text and no raw shop message by default', async ({
  page,
}) => {
  await failedLogin(page, ENGLISH);

  await expect(page.getByTestId('login-error')).toContainText(
    'The e-mail address or the password is wrong.',
  );
  await expect(page.locator('body')).not.toContainText(RAW);
  await expect(page.locator('body')).not.toContainText('internal.example');
  await expect(page.getByTestId('error-details')).toHaveCount(0);
});

test('the same failure in German is translated', async ({ page }) => {
  await failedLogin(page, 'i18n: { default_locale: de, fallback_locale: de, locales: [de] }\n');

  await expect(page.getByTestId('login-error')).toContainText(
    'Die E-Mail-Adresse oder das Passwort ist falsch.',
  );
});

test('debug.errors adds a collapsed details block with code and raw message', async ({ page }) => {
  await failedLogin(page, `${ENGLISH}debug: { errors: true }\n`);
  const details = page.getByTestId('error-details');

  await expect(details).toHaveCount(1);
  await expect(details).not.toHaveAttribute('open', '');
  await details.locator('summary').click();
  await expect(details).toContainText('invalid_login');
  await expect(details).toContainText(RAW);
});
