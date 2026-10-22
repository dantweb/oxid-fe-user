import { expect, test, type Request } from '@playwright/test';
import { withInstanceConfig } from './helpers/config';

/**
 * The shop answers in the language of the request's Accept-Language. The storefront must send ITS
 * language — a German-only instance viewed from an English browser still gets German shop content.
 */
const GERMAN_ONLY =
  'i18n: { default_locale: de, fallback_locale: de, locales: [de] }\nplugins:\n  shop: {}\n';
const ENGLISH_ONLY =
  'i18n: { default_locale: en, fallback_locale: en, locales: [en] }\nplugins:\n  shop: {}\n';

async function graphqlLanguages(
  browser: import('@playwright/test').Browser,
  yaml: string,
  browserLocale: string,
): Promise<string[]> {
  const context = await browser.newContext({ locale: browserLocale });
  const page = await context.newPage();
  await withInstanceConfig(page, yaml);
  const seen: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/graphql')) {
      seen.push(request.headers()['accept-language'] ?? '(none)');
    }
  });
  await page.goto('/shop');
  await expect(page.getByTestId('product-card').first()).toBeVisible({ timeout: 30_000 });
  await context.close();
  return seen;
}

test('a German instance asks the shop in German although the browser is English', async ({
  browser,
}) => {
  const languages = await graphqlLanguages(browser, GERMAN_ONLY, 'en-US');

  expect(languages.length).toBeGreaterThan(0);
  expect(new Set(languages)).toEqual(new Set(['de']));
});

test('an English instance asks the shop in English although the browser is German', async ({
  browser,
}) => {
  const languages = await graphqlLanguages(browser, ENGLISH_ONLY, 'de-DE');

  expect(new Set(languages)).toEqual(new Set(['en']));
});

/** Sprint 139b: the documented `?lang=` id travels with every request, next to Accept-Language. */
function collectGraphqlRequests(page: import('@playwright/test').Page): Request[] {
  const seen: Request[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/graphql')) {
      seen.push(request);
    }
  });
  return seen;
}

const langOf = (request: Request): string | null => new URL(request.url()).searchParams.get('lang');

test('a German-only instance sends lang=0 on every request, still with Accept-Language', async ({
  browser,
}) => {
  const context = await browser.newContext({ locale: 'en-US' });
  const page = await context.newPage();
  await withInstanceConfig(page, GERMAN_ONLY);
  const requests = collectGraphqlRequests(page);
  await page.goto('/shop');
  await expect(page.getByTestId('product-card').first()).toBeVisible({ timeout: 30_000 });

  expect(requests.length).toBeGreaterThan(0);
  expect(new Set(requests.map(langOf))).toEqual(new Set(['0']));
  expect(new Set(requests.map((r) => r.headers()['accept-language']))).toEqual(new Set(['de']));
  await context.close();
});

test('an English-only instance sends lang=1 on every request, still with Accept-Language', async ({
  browser,
}) => {
  const context = await browser.newContext({ locale: 'de-DE' });
  const page = await context.newPage();
  await withInstanceConfig(page, ENGLISH_ONLY);
  const requests = collectGraphqlRequests(page);
  await page.goto('/shop');
  await expect(page.getByTestId('product-card').first()).toBeVisible({ timeout: 30_000 });

  expect(new Set(requests.map(langOf))).toEqual(new Set(['1']));
  expect(new Set(requests.map((r) => r.headers()['accept-language']))).toEqual(new Set(['en']));
  await context.close();
});

test('the language id follows the language switch', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'en-US' });
  const page = await context.newPage();
  await withInstanceConfig(
    page,
    'i18n: { default_locale: en, locales: [en, de] }\nplugins:\n  shop: {}\n',
  );
  const requests = collectGraphqlRequests(page);
  await page.goto('/shop');
  await expect(page.getByTestId('product-card').first()).toBeVisible({ timeout: 30_000 });
  expect(new Set(requests.map(langOf))).toEqual(new Set(['1']));

  requests.length = 0;
  await page.getByTestId('locale-switcher').selectOption('de');
  await expect.poll(() => requests.length, { timeout: 15_000 }).toBeGreaterThan(0);
  expect(new Set(requests.map(langOf))).toEqual(new Set(['0']));
  await context.close();
});
