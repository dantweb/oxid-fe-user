import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { PEROXID_CONFIG, withInstanceConfig } from './helpers/config';

/**
 * The search lives in the shop plugin and is styled only with the --oxfe-* tokens, so every theme
 * must show it correctly. Run to regenerate the screenshots in
 * docs/dev_log/20261019/reports/search-themes/.
 */
const OUT = 'docs/dev_log/20261019/reports/search-themes';
const THEMES = ['peroxid', 'default', 'dark', 'apex'];

test.describe('search in every theme', () => {
  test.beforeAll(() => mkdirSync(OUT, { recursive: true }));

  for (const theme of THEMES) {
    test(`${theme}: box, suggestions and results are visible and inside the screen`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await withInstanceConfig(
        page,
        `theme:\n  default: ${theme}\n  active: ${theme}\n${PEROXID_CONFIG}`,
      );
      await page.goto('/');

      const input = page.getByTestId('pxd-search-input');
      await input.fill('park');
      await expect(page.getByTestId('pxd-suggestions')).toBeVisible({ timeout: 20_000 });
      await page.screenshot({ path: `${OUT}/${theme}-suggestions.png` });

      await input.press('Enter');
      await expect(page.getByTestId('product-card').first()).toBeVisible({ timeout: 20_000 });
      await input.blur();
      await expect(page.getByTestId('pxd-suggestions')).toBeHidden();
      await page.screenshot({ path: `${OUT}/${theme}-results.png` });

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
});
