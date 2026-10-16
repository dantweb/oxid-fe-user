# DONE — Sprint 09: `peroxid`, a layout plugin that overrides the default views (+ its theme)

**Date:** 2026-10-16 · **Status:** delivered (S1–S8)

## What was built

- **Override seam (core v0.4.0):** `IPlugin.overrides` (`header` / `footer` / `home`), `requires`
  (checked at boot: _plugin "peroxid" requires "shop", which is not enabled_), `defaultTheme`;
  `PluginRegistry.overrideFor` (last listed plugin wins a slot), `defaultTheme()`,
  `validateRequirements()`; new tokens `--oxfe-color-accent`, `--oxfe-font-heading`.
- **Host:** App header/footer and the front-page route resolve through the seam; the active
  theme is now **explicit `theme.active` → enabled plugin's `defaultTheme` → `theme.default`**
  (pure `resolveActiveTheme`, tested). Docs first: `docs/layout-plugins.md`.
- **`peroxid` plugin** (`plugins/peroxid/`), opt-in via `oxid-config.yaml`:
  - **Header:** content width **1200 px**, fluid below (16 px gutters), sticky; brand, navigation,
    **search** with type-ahead (storefront `products(filter: {title})`, keyboard support) and a
    `/search` results page; account entry; **cart as an icon whose badge counts distinct SKUs**
    (2 units of one product + 1 other = 2); phones: menu drawer and a search row behind buttons.
  - **Front page:** **hero block** and **three streams** (snap-scrolling rails, arrows only on
    wide mouse screens): _new_ = OXID action `oxnewest`, _today's sales_ = `oxbargain`,
    _electronic_ = the Elektronik category — configurable per instance (`config.streams`,
    validated; a typo stops the boot with a path-naming error). **Footer** to match.
- **Theme `peroxid`** (child of `default`): ivory / obsidian / brass, serif display type,
  1200 px container, generated hero photography; the hero's look lives in the theme.
- **Instance C** (`instances/example-peroxid`, SDK service on `:8092`): plugin on, no
  `theme.active` → the plugin's own theme applies.

## Verified

- **Override proof:** off → the host's own header, hero and footer, none of peroxid's; on → peroxid's
  header/hero/footer on _every_ page and none of the defaults; without `shop` → boot error.
- **Header width:** exactly 1200 px at 1920 / 1440 / 1240, then 1068 and 888 px at 1100 / 920 viewports.
- **Streams are the right products:** the rail contents equal the shop's own `oxnewest`,
  `oxbargain` (first 10, shop order) and Elektronik category queries.
- **Badge:** 1 → 1 (same SKU again) → 2; matches the cart page; aria-label carries the count.
- **Responsive, on real device profiles:** iPhone 17 Pro in **WebKit**, Samsung Galaxy S24,
  S25 Ultra, Z Fold 7 in Chromium — per device: no horizontal scroll on the front page, search
  (with suggestions open), results, product, cart, catalog, category and login; header, hero
  text and buttons inside the screen; ≥ 44 px tap targets; 16 px search text (no iOS zoom);
  rails scrollable with the next card peeking in; a real **touch drag** (Chromium) comes to rest
  exactly on a card edge (scroll-snap); menu drawer on phones. 27 screenshots archived in
  `docs/dev_log/20261016/reports/peroxid-responsive/`.

## Defects the proof found (all fixed)

1. Search submit button was 36 px — below the 44 px tap-target minimum.
2. On phones the hero's full-width primary button overflowed the hero card (`width: 100%` +
   padding on a content-box) — seen in the screenshot, then asserted (hero children inside hero).
3. Cart badge was a wide pill hiding the icon (WebKit applies `min-width` to the content box);
   suggestion thumbnails were lazy-loaded inside the dropdown and showed blank.
4. Rail arrows appeared on phone emulation (Chromium reports a mouse) — now also gated on width.

## Notes

- A drawer link once measured only its text width in a full public run; the rows are now
  explicitly full-width and the assertion reports project, element and viewport if it ever recurs.
  A tunnel `ERR_CONNECTION_RESET` also hit one public run (infrastructure, not the product).
- Browser language wins over `i18n.default_locale` when the instance offers it (documented
  behavior); the German-streams test therefore uses a German-only instance.
- Not included: a shopper-facing theme/layout switcher; peroxid checkout styling beyond tokens.

## Final numbers

- Gate: lint, vue-tsc, knip, build green; **unit 84/84**; core v0.4.0 CI green, app CI green (`0fd0eaf`).
- **Dev server, all projects** (desktop + 4 device profiles): 64 passed (12 skipped by design: the
  instance specs without containers, and the phone-menu test on the Fold's wide screen).
- **Public `https://daniil.oxiddev.de:8443`, all projects:** 64 passed, 0 failed in two full runs.
  One earlier full run had a single failure — iPhone-WebKit menu drawer, 2.8 s in — that did not
  reproduce in 7+ later runs (diagnostics now print project, element, display and viewport if it
  does). Recorded as an unexplained intermittent, not as fixed.
- **Three instances** (A deployed file, B example-b, C peroxid): 11/11 on localhost _and_ 11/11
  over the public URLs below.

## Public access to the three instances

Cloudflare's proxy only forwards a fixed set of ports (HTTPS: 443, 2053, 2083, 2087, 2096, 8443),
so `daniil.oxiddev.de:8090/8091/8092` cannot be reached through the tunnel — verified: no
connection at all on those ports, http or https. The edge router (`cf-tunnel-template`) therefore
maps the instances onto supported ports:

| URL                              | Instance                            | Host port |
| -------------------------------- | ----------------------------------- | --------- |
| `https://daniil.oxiddev.de:8443` | A — the deployed `oxid-config.yaml` | 8090      |
| `https://daniil.oxiddev.de:2053` | B — `example-b`                     | 8091      |
| `https://daniil.oxiddev.de:2083` | C — `example-peroxid`               | 8092      |

The two new origins are also in the shop's `sPaymentBaseHeadlessReturnOrigins` (checkout returns).
Exactly 8090–8092 would need a DNS-only (grey-cloud) record with a port-forward — no tunnel, no
Cloudflare TLS — or Cloudflare Spectrum; the router would then need those Host values added.
