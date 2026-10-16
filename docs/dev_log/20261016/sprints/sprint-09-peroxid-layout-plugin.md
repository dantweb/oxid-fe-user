# Sprint 09 — `peroxid`: a layout plugin that overrides the default views, and its own theme

**Date:** 2026-10-16 · **Repos:** `oxid-fe-core` (override seam) and `oxid-fe-user`
**Spec:** [`docs/layout-plugins.md`](../../../layout-plugins.md) (written first)

## Ask

Plugins with a different layout: when such a plugin is switched on it overrides the default
views. First one: **peroxid** — search in the header; header content width 1200 px but
responsive; cart as an icon with a badge showing the number of SKUs in the cart; modern,
stylish, high-end look; overrides the front page with a hero block and streams from three
sources — "new", "today sales", "electronic". Proven responsive for **iPhone 17 Pro** and
**Samsung** screens. The plugin comes with its own theme, the **peroxid theme**, declared as the plugin's `defaultTheme`.

## Stories

| #   | Story                                                                                                                                                                                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | Docs first: `docs/layout-plugins.md`                                                                                                                                                                    |
| S2  | core v0.4.0: `IPlugin.overrides` / `requires` / `defaultTheme`, `PluginRegistry.overrideFor` / `defaultTheme()` / requirement check, tokens `--oxfe-color-accent` + `--oxfe-font-heading`; tests        |
| S3  | host: header/footer/home resolved through the override seam; active theme = explicit `theme.active` → enabled plugin's `defaultTheme` → `theme.default` (pure `resolveActiveTheme`, tested)             |
| S4  | shop plugin: `skuCount` getter on the cart store                                                                                                                                                        |
| S5  | `peroxid` plugin: header (brand, nav, search with type-ahead, account, cart icon + SKU badge, mobile menu/search), `/search` page, home with hero + 3 streams, footer; i18n en/de                       |
| S6  | theme `peroxid` (ivory/obsidian/brass, serif headings, logo + hero images)                                                                                                                              |
| S7  | example instance `example-peroxid` (+ compose service, port 8092): plugin on, no explicit theme → the plugin's `defaultTheme` applies                                                                   |
| S8  | e2e: override proof (on/off), desktop 1200 px header, search, SKU badge, hero, three streams, mobile/tablet device profiles (iPhone 17 Pro on WebKit; Galaxy S24, S25 Ultra, Z Fold 7) with screenshots |

## Acceptance

- Peroxid on → `pxd-header`, hero, three streams, `pxd-footer`; the default header/home/footer
  are not rendered. Off → exactly the previous behavior (existing suite unchanged and green).
- Header content width is exactly 1200 px at wide viewports and shrinks fluidly below.
- Badge = distinct SKUs. Search finds products from the header.
- All device profiles pass the responsiveness assertions; screenshots archived.
- Quality gate green in both repos; the two-instance proof still passes (A and B unaffected).
