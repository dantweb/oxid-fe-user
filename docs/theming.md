# Theming

A **theme** is a folder under `resources/themes/<theme_id>/`. Which theme an instance runs is
decided by its `oxid-config.yaml` (`theme:` section). Themes are switched without rebuilding
the app, exactly like the other instance-specific settings (see `instance-configuration.md`).

The mechanism follows vbwd-fe-core / vbwd-fe-user:

| vbwd                                                                                                                                   | here                                                                                                                               |
| -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| fe-core ships `styles/variables.css` — a documented set of `--vbwd-*` CSS custom properties, "override these to customize the library" | **oxid-fe-core** ships `styles/variables.css` with the `--oxfe-*` design-token contract                                            |
| components read `var(--vbwd-…, <light fallback>)`, so the default look needs no theme at all                                           | every component reads `var(--oxfe-…, <fallback>)` — a missing/failed theme degrades to the default look, never to an unstyled page |
| a theme is a _preset_: `{ id, name, colors: { '--vbwd-…': value } }`                                                                   | the theme's `config.json`: `{ id, name, tokens: { '--oxfe-…': value } }`                                                           |
| `applyTheme(preset)` sets the properties on `document.documentElement`; `clearTheme` removes them                                      | core `applyTheme(theme)` / `clearTheme(theme)` — identical semantics                                                               |
| child-theme override: a theme overrides a parent                                                                                       | `parent` in `config.json`; tokens merge parent → child, and the child's LESS imports the parent's                                  |

Added on top: each theme carries a **LESS stylesheet** and **images**, compiled/copied at build
time, and the active theme is chosen from the **instance configuration**.

## Folder layout

```
resources/themes/<theme_id>/
├── config.json                main theme configuration (metadata, tokens, parent, images)
├── styles/
│   └── styles.less            the theme's stylesheet (LESS) → compiled to CSS
└── images/                    *.jpg, *.png, *.gif … copied as-is
```

The repo ships `default` (the reference look), `dark` and `apex` (child themes of `default`; `apex` is OXID's Apex look: black primary, Bootstrap-5 button geometry) and `peroxid`
(ivory, obsidian and brass with Roboto sans-serif type — the `defaultTheme` of the peroxid layout
plugin, see `layout-plugins.md`).

## `config.json`

```json
{
  "id": "default",
  "name": "Default",
  "description": "The reference look",
  "version": "1.0.0",
  "parent": null,
  "tokens": { "--oxfe-color-primary": "#0a5d9c" },
  "images": { "logo": "logo.png" }
}
```

| Key                              | Meaning                                                                                                                                              |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                             | must equal the folder name                                                                                                                           |
| `name`, `description`, `version` | metadata                                                                                                                                             |
| `parent`                         | id of the theme this one extends, or `null`. Tokens merge parent → child; `styles.less` imports the parent's LESS. Cycles are rejected at build time |
| `tokens`                         | CSS custom properties (**all keys start with `--oxfe-`**) applied on `:root` at runtime — the same shape as vbwd's `ThemePreset.colors`              |
| `images`                         | logical name → file in `images/` (`logo` is shown in the header)                                                                                     |

## The token contract (oxid-fe-core `styles/variables.css`)

Colors `--oxfe-color-{primary, primary-contrast, primary-disabled, text, text-muted, border,
input-border, background, surface, danger, warning-bg, warning-border, link, accent}`; radii
`--oxfe-radius-{sm, md, lg}`; `--oxfe-font-family`, `--oxfe-font-heading`;
`--oxfe-container-max-width`.
Components always write `var(--oxfe-…, <fallback>)`.

## `styles/styles.less`

Compiled with LESS to `…/styles/styles.css`. A theme's stylesheet declares its tokens from LESS
variables and adds theme-level styling (typography, the home hero banner — anything that is
_look_ rather than _structure_). Image URLs are written relative to the stylesheet
(`url("../images/hero.jpg")`) and work unchanged in source and output because the output keeps
the folder layout.

A child theme starts with `@import "../../default/styles/styles.less";` and re-declares only
what differs.

## Choosing a theme per instance — `oxid-config.yaml`

```yaml
theme:
  default: default # fallback: used when `active` cannot be loaded (typo, missing files)
  active: dark # the theme this instance runs
```

Which theme runs: an explicit `theme.active` wins; else the `defaultTheme` of an enabled
(layout) plugin; else `theme.default`.

At boot the app loads that theme's `/themes/<id>/config.json`, merges the parent chain, applies the
tokens (`applyTheme`) and attaches the stylesheet. If `active` is unavailable it falls back to
`default`; if that fails too the page runs on the component fallbacks (the default look).

## Build & deployment

`npm run build:themes` (`make theme`) compiles every theme into `public/themes/<id>/`
(gitignored): `config.json`, `styles/styles.css`, `images/*`. `npm run build` and `npm run dev`
run it first, so the Docker image contains all repo themes.

**Instance-specific themes without a rebuild:** the instance's `public/` overlay wins over the
bundle (`instance-configuration.md`), so a theme compiled for one customer can be dropped into
`<instance>/public/themes/<id>/` and activated from that instance's `oxid-config.yaml`.

## Makefile

`make help` lists everything: `theme` / `theme-watch` (rebuild themes), `compile` (themes +
type-check + production build), `build` / `run` / `stop` (Docker image and container for an
instance), `dev` / `debug` (dev server), `debug-e2e`, `logs`, `nginx-config`, `gate`.
