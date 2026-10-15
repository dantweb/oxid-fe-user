# DONE — Sprint 08: theming (vbwd-fe-core model)

**Date:** 2026-10-15 · **Status:** delivered (S1–S8)

## How it maps to vbwd

Studied vbwd-fe-core (`styles/variables.css`: a documented `--vbwd-*` custom-property contract
that components read with fallbacks) and vbwd-fe-user's theme-switcher (`ThemePreset.colors`,
`applyTheme`/`clearTheme` on `document.documentElement`, child-theme override). Same model here,
documented side by side in `docs/theming.md`:

- **core v0.3.0** ships `styles/variables.css` (`--oxfe-*`, in the package exports),
  `applyTheme`/`clearTheme` (vbwd semantics), `loadTheme` (parent chain merged parent→child,
  stylesheet link, **fallback to the default theme**, `null` when nothing loads), zod-validated
  `ThemeConfig`. 54 core tests.
- **Components** read `var(--oxfe-…, <old hardcoded value>)` — 14 files tokenized; a missing
  theme degrades to the default look, never an unstyled page.

## What was built in oxid-fe-user

- `resources/themes/<id>/` exactly as specified: `config.json` (main config: metadata, `tokens`,
  `parent`, `images`), `styles/styles.less`, `images/*.jpg|png|gif`. Themes: **`default`**
  (reference look, logo, hero, a gif) and **`dark`** (child theme: imports the parent's LESS,
  re-declares only the variables, own logo/hero).
- **Build** `scripts/build-themes.mjs` (+ `theme-build.mjs`, `theme-lib.mjs`): validates every
  `config.json` (id = folder, `--oxfe-` tokens, existing images, unknown parents, cycles — all
  problems reported at once), compiles LESS (`rewriteUrls: all` so a child importing the parent
  keeps working), copies images, `--theme=<id>`, `--watch`. Output `public/themes/<id>/`
  (gitignored) keeps the folder layout, so `url("../images/…")` works in source and output.
  Wired as `prebuild`/`predev`; the Docker image therefore contains every theme.
- **`oxid-config.yaml(.dist)`**: `theme: { default, active }` (`active` omitted = default);
  example instance B runs `dark`. Per-instance themes need no rebuild: the `public/` overlay can
  carry a theme folder.
- **Boot**: theme loads in parallel with the plugins; header shows the theme logo; the home page
  hero is markup from the app, look from the theme.
- **`Makefile`** — `help theme theme-watch compile build run stop dev debug debug-e2e e2e logs
nginx-config gate`. **Each command was actually run**, not just written: `theme`/`theme
THEME=dark`/unknown theme (clear failure), `compile`, `gate`, `build`+`run` (spare port,
  instance B served its dark theme and logo)/`nginx-config`/`logs`/`stop`, `dev` and `debug`
  (40 vite debug lines; ports freed).

## Verified

- Unit: 52/52 app (10 new for the theme pipeline incl. a temp-dir build with gif, child theme,
  URL rewriting, aggregated errors, LESS errors), 54/54 core; lint, vue-tsc, knip clean; `make gate` green.
- **e2e `theme.spec.ts` (4 scenarios, config answered per scenario):** default look (white
  background, logo loaded `naturalWidth > 0`, hero served as `image/jpeg`); dark child theme
  (background `rgb(18,18,18)`, own logo/hero, **inherited parent token**, catalog cards use the
  dark border color); **unknown active theme → falls back to `theme.default`**; **no loadable
  theme → storefront still fully usable** on component fallbacks.
- **Instance proof 9/9:** the same image — instance A default theme, instance B (its config) dark.
- Whole suite 21/21 on the dev server and **21/21 twice against the public instance**
  `https://daniil.oxiddev.de:8443`.

## Notes

- Tokenizing changed `text-muted` from a #444/#555/#666 mix to one `#555` (intended).
- Theme switching by the shopper at runtime (vbwd's theme-switcher UI) is not included — the API
  (`loadTheme`/`applyTheme`/`clearTheme`) supports it; only the picker plugin is missing.
