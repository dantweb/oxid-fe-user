import { expect, test, type Locator, type Page } from '@playwright/test';
import { ORDERABLE_PRODUCT_ID } from './fixtures/test-data';
import { PEROXID_CONFIG, withInstanceConfig } from './helpers/config';

/**
 * Responsiveness proof of the peroxid layout on real device profiles (see playwright.config.ts):
 * iPhone 17 Pro (WebKit), Samsung Galaxy S24, S25 Ultra and Z Fold 7 (Chromium). Every project
 * runs the same assertions; screenshots are kept as evidence.
 */

const EVIDENCE = 'docs/dev_log/20261016/reports/peroxid-responsive';
const MIN_TAP_TARGET = 44;
const COMPACT_BELOW = 900; // must match COMPACT_QUERY in the plugin
const HAILYS_ID = '062b2914d57389263ae7bdd773c70f4a';

test.beforeEach(async ({ page }) => withInstanceConfig(page, PEROXID_CONFIG));

const viewportWidth = (page: Page): number => page.viewportSize()!.width;
const isCompact = (page: Page): boolean => viewportWidth(page) < COMPACT_BELOW;

/**
 * Scrolls the page through once so lazy images load, then waits (bounded) for the images that are
 * on screen. Images inside a rail's off-screen part never load, so an unbounded wait would hang.
 */
async function settle(page: Page): Promise<void> {
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += window.innerHeight / 2) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
    window.scrollTo(0, 0);
    const loaded = Promise.all(
      Array.from(document.images).map((image) =>
        image.complete
          ? undefined
          : new Promise((resolve) => image.addEventListener('load', resolve, { once: true })),
      ),
    );
    await Promise.race([loaded, new Promise((resolve) => setTimeout(resolve, 3_000))]);
  });
}

async function shot(page: Page, name: string, locator?: Locator): Promise<void> {
  await settle(page);
  const project = test.info().project.name;
  const options = {
    path: `${EVIDENCE}/${project}-${name}.jpg`,
    type: 'jpeg',
    quality: 72,
  } as const;
  await (locator ? locator.screenshot(options) : page.screenshot({ ...options, fullPage: true }));
}

/** Nothing may force sideways scrolling of the page. */
async function expectNoHorizontalScroll(page: Page, where: string): Promise<void> {
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(overflow.scrollWidth, `${where}: page scrolls sideways`).toBeLessThanOrEqual(
    overflow.innerWidth,
  );
}

/** A box must lie inside the visible width. */
async function expectInsideViewport(page: Page, locator: Locator, what: string): Promise<void> {
  const box = await locator.boundingBox();
  expect(box, `${what}: not rendered`).not.toBeNull();
  expect(box!.x, `${what}: sticks out on the left`).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width, `${what}: sticks out on the right`).toBeLessThanOrEqual(
    viewportWidth(page) + 0.5,
  );
}

async function expectTapTarget(locator: Locator, what: string): Promise<void> {
  const box = (await locator.boundingBox())!;
  const detail = await locator.evaluate((element) => {
    const style = getComputedStyle(element);
    return `<${element.tagName.toLowerCase()}> "${(element.textContent ?? '').trim().slice(0, 20)}" display=${style.display} width=${style.width} viewport=${window.innerWidth}`;
  });
  const message = `${what} [${test.info().project.name}] ${detail}`;
  expect(box.width, `${message}: too narrow to tap`).toBeGreaterThanOrEqual(MIN_TAP_TARGET);
  expect(box.height, `${message}: too short to tap`).toBeGreaterThanOrEqual(MIN_TAP_TARGET);
}

test.describe(`peroxid layout on a real device profile`, () => {
  test('front page: nothing overflows; header, hero and calls to action fit the screen', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.getByTestId('pxd-hero')).toBeVisible();
    await expect(
      page.getByTestId('pxd-rail-electronic').getByTestId('pxd-card').first(),
    ).toBeVisible({
      timeout: 20_000,
    });

    await expectNoHorizontalScroll(page, 'front page');

    // header: everything visible, inside the screen, tappable
    const inner = page.getByTestId('pxd-header-inner');
    await expectInsideViewport(page, inner, 'header');
    for (const id of ['pxd-brand', 'pxd-account', 'pxd-cart']) {
      await expectInsideViewport(page, page.getByTestId(id), id);
    }
    for (const id of ['pxd-account', 'pxd-cart']) {
      await expectTapTarget(page.getByTestId(id), id);
    }
    if (isCompact(page)) {
      for (const id of ['pxd-menu-toggle', 'pxd-search-toggle']) {
        await expectInsideViewport(page, page.getByTestId(id), id);
        await expectTapTarget(page.getByTestId(id), id);
      }
      await expect(page.getByTestId('pxd-search-input')).toHaveCount(0); // behind the button
    } else {
      await expectInsideViewport(page, page.getByTestId('pxd-search-input'), 'search field');
    }

    // header width: the 1200 px design width shrinks to the screen (16 px gutters)
    const headerWidth = (await inner.boundingBox())!.width;
    expect(headerWidth).toBe(Math.min(1200, viewportWidth(page) - 32));

    // hero: the card, its text and its buttons all stay inside it
    const hero = page.getByTestId('pxd-hero');
    await expectInsideViewport(page, hero, 'hero');
    const heroBox = (await hero.boundingBox())!;
    for (const id of ['pxd-hero-title', 'pxd-hero-cta', 'pxd-hero-secondary']) {
      const box = (await page.getByTestId(id).boundingBox())!;
      expect(box.x, `${id} left of hero`).toBeGreaterThanOrEqual(heroBox.x);
      expect(box.x + box.width, `${id} right of hero`).toBeLessThanOrEqual(
        heroBox.x + heroBox.width + 0.5,
      );
    }
    await expectTapTarget(page.getByTestId('pxd-hero-cta'), 'hero button');
    const titleSize = await page
      .getByTestId('pxd-hero-title')
      .evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
    expect(titleSize, 'hero headline stays legible').toBeGreaterThanOrEqual(30);

    // the theme's hero photograph is what is drawn
    const background = await hero.evaluate((element) => getComputedStyle(element).backgroundImage);
    expect(background).toContain('/themes/peroxid/images/hero.jpg');

    await shot(page, 'home');
    await shot(page, 'header', page.getByTestId('pxd-header'));
  });

  test('the three streams swipe: each is scrollable and the next card peeks in', async ({
    page,
    browserName,
  }) => {
    await page.goto('/');
    const rails = ['new', 'sales', 'electronic'];
    for (const stream of rails) {
      const rail = page.getByTestId(`pxd-rail-${stream}`);
      await expect(rail.getByTestId('pxd-card').first()).toBeVisible({ timeout: 20_000 });
      const track = rail.getByTestId('pxd-rail-track');

      const metrics = await track.evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          scrollable: element.scrollWidth > element.clientWidth,
          overflowX: style.overflowX,
          snap: style.scrollSnapType,
        };
      });
      expect(metrics.scrollable, `${stream}: nothing to scroll`).toBe(true);
      expect(['auto', 'scroll']).toContain(metrics.overflowX);
      expect(metrics.snap).toContain('x');

      await expectInsideViewport(page, track, `${stream} stream`);

      if (isCompact(page)) {
        // the second card starts inside the screen: the visible cue that there is more
        const cards = rail.getByTestId('pxd-card');
        const first = (await cards.nth(0).boundingBox())!;
        const second = (await cards.nth(1).boundingBox())!;
        expect(second.x, `${stream}: next card does not peek in`).toBeLessThan(viewportWidth(page));
        expect(second.x).toBeGreaterThan(first.x + first.width); // a gap, not overlapping
        // arrow buttons are a mouse affordance — absent on phones
        await expect(rail.getByTestId('pxd-rail-next')).toBeHidden();
      }
    }

    // swipe the first stream with a real touch gesture where the engine allows it
    const track = page.getByTestId('pxd-rail-new').getByTestId('pxd-rail-track');
    await track.scrollIntoViewIfNeeded(); // a gesture needs a point inside the visible screen
    const box = (await track.boundingBox())!;
    if (browserName === 'chromium') {
      // a real finger: touchStart, a run of touchMoves, touchEnd
      const cdp = await page.context().newCDPSession(page);
      const y = Math.round(box.y + box.height / 2);
      const startX = Math.round(box.x + box.width * 0.8);
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x: startX, y }],
      });
      for (let step = 1; step <= 12; step += 1) {
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [{ x: startX - step * 16, y }],
        });
        await page.waitForTimeout(16);
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else {
      // WebKit has no touch-drag synthesis in Playwright; scroll programmatically and let snapping act
      await track.evaluate((element) => element.scrollBy({ left: element.clientWidth * 0.6 }));
    }
    await expect
      .poll(() => track.evaluate((element) => element.scrollLeft), { timeout: 5_000 })
      .toBeGreaterThan(0);

    // scroll-snap: the stream comes to rest exactly on a card's left edge
    await expect
      .poll(
        () =>
          track.evaluate((element) => {
            const edges = Array.from(element.children).map(
              (card) => (card as HTMLElement).offsetLeft - (element as HTMLElement).offsetLeft,
            );
            return edges.some((edge) => Math.abs(edge - element.scrollLeft) <= 1);
          }),
        { timeout: 5_000 },
      )
      .toBe(true);

    await shot(page, 'streams', page.getByTestId('pxd-rail-sales'));
  });

  test('search works by touch: open it, get suggestions on screen, reach a product', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.getByTestId('pxd-header')).toBeVisible();

    if (isCompact(page)) {
      await page.getByTestId('pxd-search-toggle').tap();
      await expect(page.getByTestId('pxd-search-row')).toBeVisible();
      await expectInsideViewport(page, page.getByTestId('pxd-search-row'), 'search row');
    }
    const input = page.getByTestId('pxd-search-input');
    await expectInsideViewport(page, input, 'search field');
    await expectTapTarget(page.getByTestId('pxd-search-submit'), 'search submit');
    // 16 px: smaller text makes iOS Safari zoom the page when the field is focused
    const inputSize = await input.evaluate((element) =>
      parseFloat(getComputedStyle(element).fontSize),
    );
    expect(inputSize).toBeGreaterThanOrEqual(16);

    await input.fill('sensor');
    const list = page.getByTestId('pxd-suggestions');
    await expect(list).toBeVisible({ timeout: 20_000 });
    await expectInsideViewport(page, list, 'suggestions');
    await expectNoHorizontalScroll(page, 'search with suggestions');
    await shot(page, 'search-suggestions');

    const suggestion = page.getByTestId('pxd-suggestion').first();
    expect((await suggestion.boundingBox())!.height).toBeGreaterThanOrEqual(MIN_TAP_TARGET);
    await suggestion.tap();
    await expect(page).toHaveURL(/\/shop\/product\//);
    await expect(page.getByTestId('pxd-header')).toBeVisible();

    // results page
    await page.goto('/search?q=sensor');
    await expect(page.getByTestId('product-card').first()).toBeVisible({ timeout: 20_000 });
    await expectNoHorizontalScroll(page, 'search results');
    await shot(page, 'search-results');
  });

  test('phones get a menu drawer with tappable entries', async ({ page }) => {
    test.skip(!isCompact(page), 'wide screens show the navigation inline');
    await page.goto('/');

    await page.getByTestId('pxd-menu-toggle').tap();
    const drawer = page.getByTestId('pxd-drawer');
    await expect(drawer).toBeVisible();
    await expectInsideViewport(page, drawer, 'menu drawer');
    const links = drawer.getByTestId('pxd-nav-link');
    expect(await links.count()).toBeGreaterThan(0);
    for (let index = 0; index < (await links.count()); index += 1) {
      await expectTapTarget(links.nth(index).locator('xpath=.'), `drawer link ${index}`);
    }
    await shot(page, 'menu');

    await links.first().tap();
    await expect(page).toHaveURL(/\/shop/);
    await expect(drawer).toHaveCount(0); // closes on navigation
  });

  test('the cart icon badge shows the SKU count and stays on screen', async ({ page }) => {
    const badge = page.getByTestId('pxd-cart-badge');
    for (const id of [ORDERABLE_PRODUCT_ID, ORDERABLE_PRODUCT_ID, HAILYS_ID]) {
      await page.goto(`/shop/product/${id}`);
      await page.getByTestId('add-to-cart').tap();
      await expect(page.getByTestId('added-note')).toBeVisible();
    }

    await expect(badge).toHaveText('2'); // two distinct products, three units
    await expectInsideViewport(page, badge, 'cart badge');
    await expectNoHorizontalScroll(page, 'product page');
    await shot(page, 'cart-badge', page.getByTestId('pxd-header'));

    await page.getByTestId('pxd-cart').tap();
    await expect(page).toHaveURL(/\/shop\/cart$/);
    await expectNoHorizontalScroll(page, 'cart page');
  });

  test('catalog, category and login pages inside the layout do not overflow either', async ({
    page,
  }) => {
    for (const path of [
      '/shop',
      '/shop/category/8a7ff3dcbc30480b19228b4bf00c8386',
      '/login',
      '/shop/cart',
    ]) {
      await page.goto(path);
      await expect(page.getByTestId('pxd-header')).toBeVisible();
      await page.waitForLoadState('networkidle');
      await expectNoHorizontalScroll(page, path);
    }
  });
});
