import { expect, test } from '@playwright/test';
import { ORDERABLE_PRODUCT_ID } from './fixtures/test-data';
import { PEROXID_CONFIG, storefront, withInstanceConfig } from './helpers/config';
import { DEFAULT_BASE_URL } from './helpers/session';

const ELECTRONICS_CATEGORY = '91c959d1be6af96041072032ead2daf0';
const HAILYS_ID = '062b2914d57389263ae7bdd773c70f4a';

const bodyBackground = (page: import('@playwright/test').Page): Promise<string> =>
  page.evaluate(() => getComputedStyle(document.body).backgroundColor);

test.describe('peroxid is a layout plugin: switched on it overrides the default views', () => {
  test('switched OFF the host keeps its own header, front page and footer', async ({ page }) => {
    await withInstanceConfig(page, 'plugins:\n  shop: {}\n');
    await page.goto('/');

    await expect(page.locator('.header__brand')).toBeVisible();
    await expect(page.getByTestId('home-hero')).toBeVisible();
    await expect(page.locator('footer.footer')).toBeVisible();
    for (const id of ['pxd-header', 'pxd-hero', 'pxd-footer', 'pxd-rail-new']) {
      await expect(page.getByTestId(id)).toHaveCount(0);
    }
  });

  test('switched ON it replaces header, front page and footer', async ({ page }) => {
    await withInstanceConfig(page, PEROXID_CONFIG);
    await page.goto('/');

    await expect(page.getByTestId('pxd-header')).toBeVisible();
    await expect(page.getByTestId('pxd-hero')).toBeVisible();
    await expect(page.getByTestId('pxd-footer')).toBeVisible();
    // the defaults are gone, not just hidden
    await expect(page.locator('.header__brand')).toHaveCount(0);
    await expect(page.getByTestId('home-hero')).toHaveCount(0);
    await expect(page.locator('footer.footer')).toHaveCount(0);
  });

  test('the override applies on every page, not only the front page', async ({ page }) => {
    await withInstanceConfig(page, PEROXID_CONFIG);
    for (const path of ['/shop', `/shop/product/${ORDERABLE_PRODUCT_ID}`, '/shop/cart', '/login']) {
      await page.goto(path);
      await expect(page.getByTestId('pxd-header'), path).toBeVisible();
      await expect(page.getByTestId('pxd-footer'), path).toBeVisible();
    }
  });

  test('without the shop plugin it refuses to start, naming the problem', async ({ page }) => {
    await withInstanceConfig(page, 'plugins:\n  peroxid: {}\n');
    await page.goto('/');

    await expect(page.getByTestId('boot-error')).toContainText(
      'plugin "peroxid" requires "shop", which is not enabled',
    );
  });
});

test.describe('peroxid and its partner theme', () => {
  test('enabling the plugin alone applies its defaultTheme (peroxid)', async ({ page }) => {
    await withInstanceConfig(page, PEROXID_CONFIG);
    await page.goto('/');
    await expect(page.getByTestId('pxd-hero')).toBeVisible();

    expect(await bodyBackground(page)).toBe('rgb(251, 249, 246)'); // ivory
    await expect(page.locator('#oxfe-theme-css')).toHaveAttribute('href', /\/themes\/peroxid\//);
    const accent = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--oxfe-color-accent').trim(),
    );
    expect(accent).toBe('#b08d57'); // brass
  });

  test('an explicit theme.active always wins over the plugin’s default theme', async ({ page }) => {
    await withInstanceConfig(page, `theme:\n  default: default\n  active: dark\n${PEROXID_CONFIG}`);
    await page.goto('/');
    await expect(page.getByTestId('pxd-hero')).toBeVisible();

    expect(await bodyBackground(page)).toBe('rgb(18, 18, 18)');
    await expect(page.locator('#oxfe-theme-css')).toHaveAttribute('href', /\/themes\/dark\//);
  });

  test('the hero photography comes from the theme and really loads', async ({ page, request }) => {
    await withInstanceConfig(page, PEROXID_CONFIG);
    await page.goto('/');
    const background = await page
      .getByTestId('pxd-hero')
      .evaluate((element) => getComputedStyle(element).backgroundImage);

    expect(background).toContain('/themes/peroxid/images/hero.jpg');
    const url = new URL(background.match(/url\("?([^")]+)"?\)/)![1], page.url()).toString();
    const image = await request.get(url);
    expect(image.status()).toBe(200);
    expect(image.headers()['content-type']).toContain('image/jpeg');
  });
});

test.describe('peroxid header', () => {
  test.beforeEach(async ({ page }) => withInstanceConfig(page, PEROXID_CONFIG));

  test('content is exactly 1200 px wide on wide screens and fluid below', async ({ page }) => {
    const innerWidth = async (viewportWidth: number): Promise<number> => {
      await page.setViewportSize({ width: viewportWidth, height: 900 });
      await page.goto('/');
      await expect(page.getByTestId('pxd-header-inner')).toBeVisible();
      return (await page.getByTestId('pxd-header-inner').boundingBox())!.width;
    };

    expect(await innerWidth(1920)).toBe(1200);
    expect(await innerWidth(1440)).toBe(1200);
    expect(await innerWidth(1240)).toBe(1200);
    expect(await innerWidth(1100)).toBe(1100 - 32); // fluid, 16 px gutters
    expect(await innerWidth(920)).toBe(920 - 32);
  });

  test('has search, an account entry and the cart as an icon', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    await expect(page.getByTestId('pxd-search-input')).toBeVisible();
    await expect(page.getByTestId('pxd-account')).toBeVisible();
    const cart = page.getByTestId('pxd-cart');
    await expect(cart).toBeVisible();
    await expect(cart.locator('svg')).toBeVisible();
    expect((await cart.innerText()).trim()).toBe(''); // an icon, no text label
    await expect(page.getByTestId('pxd-cart-badge')).toHaveCount(0); // empty cart: no badge
  });

  test('the cart badge counts distinct SKUs, not units', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const badge = page.getByTestId('pxd-cart-badge');
    const addToCart = async (id: string): Promise<void> => {
      await page.goto(`/shop/product/${id}`);
      await page.getByTestId('add-to-cart').click();
      await expect(page.getByTestId('added-note')).toBeVisible();
    };

    await addToCart(ORDERABLE_PRODUCT_ID);
    await expect(badge).toHaveText('1');

    await addToCart(ORDERABLE_PRODUCT_ID); // same SKU again: two units, still one SKU
    await expect(badge).toHaveText('1');

    await addToCart(HAILYS_ID);
    await expect(badge).toHaveText('2');
    await expect(page.getByTestId('pxd-cart')).toHaveAttribute('aria-label', /2/);

    // the cart page agrees: 2 rows, the first with amount 2
    await page.getByTestId('pxd-cart').click();
    await expect(page).toHaveURL(/\/shop\/cart$/);
    await expect(page.getByTestId('cart-row')).toHaveCount(2);

    await page
      .getByRole('button', { name: /remove|entfernen/i })
      .first()
      .click();
    await expect(badge).toHaveText('1');
  });

  test('search: type-ahead suggestions, Enter opens paged results, a suggestion opens the product', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    const input = page.getByTestId('pxd-search-input');
    await input.fill('sensor');
    const suggestions = page.getByTestId('pxd-suggestion');
    await expect(suggestions.first()).toBeVisible({ timeout: 20_000 });
    for (const text of await suggestions.allInnerTexts()) {
      expect(text.toLowerCase()).toContain('sensor');
    }

    await input.press('Enter');
    await expect(page).toHaveURL(/\/search\?q=sensor$/);
    await expect(page.getByTestId('pxd-results-title')).toContainText('sensor');
    const cards = page.getByTestId('product-card-title');
    await expect(cards.first()).toBeVisible({ timeout: 20_000 });
    for (const text of await cards.allInnerTexts()) {
      expect(text.toLowerCase()).toContain('sensor');
    }
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);

    // keyboard: ArrowDown + Enter takes the highlighted suggestion to its product page
    await input.fill('');
    await input.fill('sensor');
    await expect(suggestions.first()).toBeVisible({ timeout: 20_000 });
    await input.press('ArrowDown');
    await input.press('Enter');
    await expect(page).toHaveURL(/\/shop\/product\//);
  });

  test('search with no match says so', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/search?q=zzzqqqxxx');
    await expect(page.getByTestId('pxd-results-empty')).toBeVisible({ timeout: 20_000 });
  });
});

test.describe('peroxid front page: hero and three product streams', () => {
  test.beforeEach(async ({ page }) => withInstanceConfig(page, PEROXID_CONFIG));

  test('a hero block with headline and calls to action', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('pxd-hero')).toBeVisible();
    await expect(page.getByTestId('pxd-hero-title')).not.toBeEmpty();
    await expect(page.getByTestId('pxd-hero-cta')).toHaveAttribute('href', '/shop');
    await expect(page.getByTestId('pxd-hero-secondary')).toHaveAttribute(
      'href',
      '#pxd-stream-sales',
    );
  });

  test('streams new, today’s sales and electronics hold the right products', async ({
    page,
    request,
  }) => {
    await page.goto('/');
    const titles = page.getByTestId('pxd-rail-title');
    await expect(titles).toHaveText(['New arrivals', 'Today’s offers', 'Electronics'], {
      timeout: 20_000,
    });

    const railIds = async (stream: string): Promise<string[]> => {
      const track = page.getByTestId(`pxd-rail-${stream}`);
      await expect(track.getByTestId('pxd-card').first()).toBeVisible({ timeout: 20_000 });
      const hrefs = await track
        .getByTestId('pxd-card')
        .locator('a')
        .evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''));
      return hrefs.map((href) => href.split('/').pop() as string);
    };
    const actionIds = async (action: string): Promise<string[]> =>
      (
        await storefront<{ action: { products: { id: string }[] } }>(
          request,
          `{ action(actionId: "${action}") { products { id } } }`,
          DEFAULT_BASE_URL,
        )
      ).action.products.map((product) => product.id);

    // new = OXID action "oxnewest", today's sales = "oxbargain" (first 10, in the shop's order)
    expect(await railIds('new')).toEqual((await actionIds('oxnewest')).slice(0, 10));
    expect(await railIds('sales')).toEqual((await actionIds('oxbargain')).slice(0, 10));

    // electronics = the Elektronik category
    const electronics = (
      await storefront<{ products: { id: string }[] }>(
        request,
        `{ products(filter: { category: { equals: "${ELECTRONICS_CATEGORY}" } }, pagination: { offset: 0, limit: 10 }) { id } }`,
        DEFAULT_BASE_URL,
      )
    ).products.map((product) => product.id);
    expect(await railIds('electronic')).toEqual(electronics);
  });

  test('every card links to its product page', async ({ page }) => {
    await page.goto('/');
    const card = page.getByTestId('pxd-rail-electronic').getByTestId('pxd-card').first();
    await expect(card).toBeVisible({ timeout: 20_000 });
    const title = await card.locator('h3').innerText();
    await card.locator('a').click();

    await expect(page).toHaveURL(/\/shop\/product\//);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
  });

  test('streams are configurable per instance and titles follow the instance language', async ({
    page,
  }) => {
    await withInstanceConfig(
      page,
      `i18n:
  default_locale: de
  locales: [de]
plugins:
  shop: {}
  peroxid:
    config:
      streams:
        - { id: electronic, type: category, ref: ${ELECTRONICS_CATEGORY}, limit: 3 }
        - { id: new, type: action, ref: oxnewest, limit: 2 }
`,
    );
    await page.goto('/');

    await expect(page.getByTestId('pxd-rail-title')).toHaveText(['Elektronik', 'Neuheiten'], {
      timeout: 20_000,
    });
    await expect(page.getByTestId('pxd-rail-electronic').getByTestId('pxd-card')).toHaveCount(3);
    await expect(page.getByTestId('pxd-rail-new').getByTestId('pxd-card')).toHaveCount(2);
    await expect(page.getByTestId('pxd-rail-sales')).toHaveCount(0);
  });
});
