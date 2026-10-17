import { expect, test } from '@playwright/test';
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
