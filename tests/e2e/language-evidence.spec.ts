import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { PEROXID_CONFIG, withInstanceConfig } from './helpers/config';

/**
 * Sprint 16 evidence: the peroxid language dropdown in every theme (open, with the current language
 * marked). Regenerates docs/dev_log/20261020/reports/language-switch-after/.
 */
const OUT = 'docs/dev_log/20261020/reports/language-switch-after';
const THEMES = ['peroxid', 'default', 'dark', 'apex'];

test.describe('language switch in every theme', () => {
  test.beforeAll(() => mkdirSync(OUT, { recursive: true }));

  for (const theme of THEMES) {
    test(`${theme}: dropdown open, inside the screen`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await withInstanceConfig(
        page,
        `theme:\n  default: ${theme}\n  active: ${theme}\ni18n: { default_locale: en, locales: [en, de] }\n${PEROXID_CONFIG}`,
      );
      await page.goto('/');
      await page.getByTestId('pxd-language').click();
      const list = page.getByTestId('pxd-language-list');
      await expect(list).toBeVisible();
      const box = await list.boundingBox();
      expect(box && box.x >= 0 && box.x + box.width <= 1440).toBe(true);
      await page.screenshot({
        path: `${OUT}/${theme}-desktop-open.png`,
        clip: { x: 0, y: 0, width: 1440, height: 320 },
      });
    });
  }

  test('phone drawer (peroxid theme)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await withInstanceConfig(
      page,
      `i18n: { default_locale: en, locales: [en, de] }\n${PEROXID_CONFIG}`,
    );
    await page.goto('/');
    await page.getByTestId('pxd-menu-toggle').click();
    await expect(
      page.getByTestId('pxd-drawer').getByTestId('pxd-language-option').first(),
    ).toBeVisible();
    await page.screenshot({ path: `${OUT}/peroxid-phone-drawer.png` });
  });
});
