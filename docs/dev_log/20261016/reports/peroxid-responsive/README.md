# Peroxid — responsiveness evidence

Screenshots written by `tests/e2e/peroxid-responsive.spec.ts` (`<device>-<view>.jpg`), one set per
device profile. They are produced after the assertions on that view passed, so each image shows a
state the test verified (no horizontal scroll, everything inside the viewport, ≥ 44 px tap targets).

| Profile            | Engine   | CSS viewport                   | Layout                                 |
| ------------------ | -------- | ------------------------------ | -------------------------------------- |
| `iphone-17-pro`    | WebKit   | 402 × 681 @3x                  | compact (menu + search behind buttons) |
| `galaxy-s24`       | Chromium | 360 × 780 @3x                  | compact                                |
| `galaxy-s25-ultra` | Chromium | 412 × 915 @3.5x                | compact                                |
| `galaxy-z-fold-7`  | Chromium | 984 × 1016 @2x (inner display) | wide: inline navigation and search     |

Views: `home` (full page: hero + three streams + footer), `header` (clip), `streams` (the
"today's offers" stream), `search-suggestions` (type-ahead open on top of the page),
`search-results`, `menu` (phones: drawer open), `cart-badge` (header after adding 2 SKUs / 3 units).

Regenerate: `npx playwright test peroxid-responsive`.
