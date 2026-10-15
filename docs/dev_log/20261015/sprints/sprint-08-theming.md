# Sprint 08 — theming (vbwd-fe-core model)

**Date:** 2026-10-15 · **Repos:** `oxid-fe-core` (token contract + apply/load) and `oxid-fe-user`
**Spec:** [`docs/theming.md`](../../../theming.md) (written first) · **Reference:**
vbwd-fe-core `styles/variables.css`, vbwd-fe-user-plugin-theme-switcher (`applyTheme`, presets),
child-theme override.

## Ask

Themes implemented as in vbwd-fe-core: a CSS-variable token contract in core, themes as presets
applied on `:root`, child-theme override. Themes live in
`resources/themes/<theme_id>/` — `styles/styles.less`, `images/*.jpg|png|gif`, `config.json`
(main theme config); default theme id `default`. `oxid-config.yaml` defines the **default** and
the **active** theme. A `Makefile` with commands to rebuild the theme, recompile, build and run,
and debug.

## Stories

| #   | Story                                                                                                                                                                                                            |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | Docs first: `docs/theming.md`                                                                                                                                                                                    |
| S2  | core: `styles/variables.css` (`--oxfe-*` contract, shipped in the package), `ThemeConfig`, `applyTheme`/`clearTheme`, `loadTheme` (parent chain, stylesheet link, fallback to the default theme) + tests; v0.3.0 |
| S3  | `scripts/build-themes.mjs` (+ pure `theme-lib.mjs`): validate `config.json`, compile LESS, copy images, `--theme=<id>` and `--watch`; unit-tested                                                                |
| S4  | Themes `default` and `dark` (child) with LESS, `config.json` and generated `jpg`/`png`/`gif` images                                                                                                              |
| S5  | Components consume `var(--oxfe-…, fallback)` instead of hardcoded values; header shows the theme logo; home hero is theme-styled                                                                                 |
| S6  | `oxid-config.yaml(.dist)` `theme:` section, schema, boot-time loading                                                                                                                                            |
| S7  | `Makefile`: theme, theme-watch, compile, build, run, stop, dev, debug, debug-e2e, logs, nginx-config, gate, help                                                                                                 |
| S8  | e2e: instance A renders the default theme, instance B the dark child theme (computed colors, logo image loaded, hero background); suite green                                                                    |

## Acceptance

- Same image, two instances: different `theme.active` → visibly different look, no rebuild.
- A missing active theme falls back to `theme.default`; a missing default leaves the page
  fully usable on the component fallbacks.
- Quality gate green in both repos; `make help` documents every command and each command runs.
