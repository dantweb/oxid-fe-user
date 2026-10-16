import { expect, test } from '@playwright/test';
import { defaultInstanceConfig } from '../../src/config/schema';
import {
  deployedConfig,
  deployedConfigFile,
  expectedPublicConfig,
  escapeRegExp,
  productsPerPage,
  shopName,
} from './helpers/instance-config';

/**
 * Proof that the deployment is driven by `oxid-config.yaml`: what the storefront serves and
 * shows at /shop is what this repo's file says — and the file differs from the built-in
 * defaults, so these checks cannot pass on defaults by accident.
 * Run against the public instance:  E2E_BASE_URL=https://daniil.oxiddev.de:8443 npx playwright test deployed-config
 */
test.describe('the deployment uses oxid-config.yaml', () => {
  test('the file is a real instance config, not a copy of the defaults', () => {
    expect(deployedConfigFile).toBe('oxid-config.yaml');
    const defaults = defaultInstanceConfig();
    expect(deployedConfig().instance.id).not.toBe(defaults.instance.id);
    expect(shopName()).not.toBe(defaults.instance.name);
    expect(productsPerPage()).not.toBe(12);
  });

  test('the server serves the config RENDERED from this file at /oxid-config.json', async ({
    request,
  }) => {
    const response = await request.get('/oxid-config.json');

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('json');
    expect(response.headers()['cache-control']).toContain('no-store');
    expect(await response.json()).toEqual(expectedPublicConfig());
  });

  test('the deployment YAML itself is never served (404 at every path)', async ({ request }) => {
    for (const path of [
      '/oxid-config.yaml',
      '/oxid-config.yaml.dist',
      '/instances/example-b/oxid-config.yaml',
    ]) {
      const response = await request.get(path);
      const body = await response.text();
      expect(
        response.status() === 404 || response.headers()['content-type']?.includes('html'),
      ).toBe(true);
      // not even the SPA fallback may carry config content
      expect(body).not.toContain('products_per_page');
      expect(body).not.toContain('graphql_url');
    }
  });

  test('/shop shows the configured shop name, page size and languages', async ({ page }) => {
    await page.goto('/shop');

    // shop name from `instance.name`: header brand and page title
    await expect(page.locator('.header__brand')).toHaveText(shopName());
    await expect(page).toHaveTitle(new RegExp(` · ${escapeRegExp(shopName())}$`));

    // page size from `plugins.shop.config.products_per_page`
    await expect(page.getByTestId('product-card')).toHaveCount(productsPerPage(), {
      timeout: 20_000,
    });

    // languages from `i18n.locales`
    const options = page.getByTestId('locale-switcher').locator('option');
    await expect(options).toHaveText(deployedConfig().i18n.locales.map((l) => l.toUpperCase()));
  });

  test('the configured page size really drives pagination', async ({ page }) => {
    await page.goto('/shop');
    const titles = page.getByTestId('product-card-title');
    await expect(titles).toHaveCount(productsPerPage(), { timeout: 20_000 });
    const firstPage = await titles.allInnerTexts();

    await page.getByRole('button', { name: /next|weiter/i }).click();
    await expect(titles.first()).not.toHaveText(firstPage[0], { timeout: 20_000 });
    await expect(titles).toHaveCount(productsPerPage());
    expect(await titles.allInnerTexts()).not.toEqual(firstPage);
  });
});
