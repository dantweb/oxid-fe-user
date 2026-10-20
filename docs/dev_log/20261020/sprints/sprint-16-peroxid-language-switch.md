# Sprint 16 — peroxid gets the language switch, as a dropdown like Apex

**Date:** 2026-10-20 · **Repos:** `oxid-fe-core` (shared switching logic), `oxid-fe-user` (`peroxid`, host switcher), `hydroxid-project` (inherits; pin bump)
**Binding rules:** [`../../20261019/sprints/_engeneering_requirements.md`](../../20261019/sprints/_engeneering_requirements.md) (TDD, SOLID, DRY, Clean code, No overengineering) plus the repo-wide file it extends.
**Branch:** `feature/peroxid-language-switcher` (from `main` `622f63f`)

## Ask

The peroxid layout plugin must offer the language change, as a **dropdown like the Apex theme** of
the OXID shop, working **exactly like the switch of the default (non-peroxid) header**.

## Starting point — tested first on the local instances (2026-10-20)

Probed with Playwright against the tunnelled local instances (evidence:
[`../reports/language-switch-before/`](../reports/language-switch-before/)):

| Instance                                   | Header  | Language switch                                                                                                                                                                                     |
| ------------------------------------------ | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `https://daniil.oxiddev.de:8443` (default) | host    | `<select data-testid="locale-switcher">` with `EN / DE`. Choosing DE: `html lang=de`, the navigation re-renders ("Cart" → "Warenkorb"), the choice is stored (`oxfe_locale`) and survives a reload. |
| `https://daniil.oxiddev.de:2083` (peroxid) | peroxid | **none** — not in the desktop header, not in the mobile drawer.                                                                                                                                     |

How the default switch works today (`src/components/LocaleSwitcher.vue`, `src/i18n/index.ts`):
the ordered locale list comes from the instance config (`i18n.locales`), the choice sets vue-i18n's
`locale`, is persisted under `LOCALE_STORAGE_KEY`, is picked up again at boot (`pickLocale`), and
the shop answers in that language because core sends it as `Accept-Language` (core 0.9.0).

What Apex does (`apex-theme/tpl/widget/header/languages.html.twig`): a dropdown whose toggle shows
the **current language's name**; the menu lists every language **by name**, the active one marked,
each entry a link with `hreflang`. Shown only when more than one language exists.

Two constraints found:

- `plugins/peroxid` may not import from the host (`src/…`), so it cannot reuse
  `LocaleSwitcher.vue` or `instanceKey` as they are. The switching logic must move one level down,
  to **core**, where both headers can use it (DRY, DIP).
- The storefront GraphQL API has no language-name query (`Language` carries only an id). Names come
  from the browser: `Intl.DisplayNames([code], { type: 'language' }).of(code)` gives the language's
  own name ("Deutsch", "English", "Français"); fallback is the upper-cased code. No config, no copy.

## Design (smallest thing that works)

**core**

- `useLocaleSwitch()` composable: `{ locale, locales, switchTo(code) }`. `switchTo` sets vue-i18n's
  locale and persists it under `LOCALE_STORAGE_KEY` (moved to core; the host imports it from there).
  `locales` is the **ordered** list the host provides through a core-owned injection key
  (`localesKey`), falling back to vue-i18n's `availableLocales`.
- `languageName(code)`: pure, `Intl.DisplayNames` with the code as fallback.

**oxid-fe-user**

- Host: `createAppI18n`/bootstrap `provide(localesKey, config.i18n.locales)`; `LocaleSwitcher.vue`
  becomes a thin `<select>` over `useLocaleSwitch()` (behaviour unchanged, same `data-testid`).
- peroxid: new `components/LanguageMenu.vue` — a dropdown in the Apex shape: a button showing the
  current language name (`data-testid="pxd-language"`), a listbox of names
  (`data-testid="pxd-language-option"`), the active one marked, keyboard (Arrow/Enter/Escape) and
  outside-click handling like `SearchBox`, hidden when only one locale is configured. Placed in the
  header controls (desktop) and in the drawer (compact); styled with `--oxfe-*` tokens only so every
  theme works. New i18n group `peroxid.language.*` (label, open).
- Compact behaviour: a full-width list in the drawer (no nested popover on a phone).

**hydroxid-project**: inherits the header (it spreads `peroxid`); its `extendMessages` merges per
group, so the new `language` group arrives untouched. Pin bump after release; search screenshots per
theme as in sprint 13.

Not built: flags, a server-side language list, URL-based language (`/de/…`), `hreflang` links
(the SPA has no per-language URLs; `<html lang>` already follows the locale).

## Stories (test first)

| #   | Story                                                                                                                                                                                                                                                                                                   | Repo |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| S1  | **Red e2e:** `tests/e2e/peroxid-language.spec.ts` — on the peroxid layout: the language control is visible (desktop) and in the drawer (phone); choosing Deutsch changes `html lang`, the nav copy and a shop-delivered title; the choice survives a reload; with one locale it is absent. Fails today. | user |
| S2  | `useLocaleSwitch` + `localesKey` + `languageName` in core, unit-tested (switch sets locale and stores it; storage throwing is survived; order follows the provided list; `languageName('de') === 'Deutsch'`, unknown code → `XX`).                                                                      | core |
| S3  | Host uses core: provide `localesKey`, `LocaleSwitcher.vue` over the composable; `LOCALE_STORAGE_KEY` imported from core. Existing unit tests (`pickLocale`, `activeLocale`) and e2e (`smoke`, `instances`, `deployed-config`) stay green.                                                               | user |
| S4  | `LanguageMenu.vue` in peroxid (Apex shape), placed in header + drawer; i18n keys en/de; unit test of the menu (renders names in order, marks the active one, emits the switch, closes on Escape/outside, hidden with one locale).                                                                       | user |
| S5  | S1 green; responsive proof added to `peroxid-responsive.spec.ts` (tap target ≥ 44 px, inside the viewport, no horizontal scroll); theme screenshots (peroxid, default, dark, apex) into `reports/language-switch-after/`.                                                                               | user |
| S6  | Docs (`layout-plugins.md`: header now has the switch; core README), outcome section, status; gates green in core and user; release core → user; hydroxid pin bump + its unit/e2e, screenshots for the three hydroxid instances.                                                                         | all  |

## Acceptance

- On a peroxid instance with `locales: [en, de]`, the header shows a dropdown with the current
  language's name; choosing the other language behaves exactly like the default header's switch:
  `html lang`, UI copy, shop-delivered content and persistence across reloads.
- On a phone the switch is reachable from the drawer with a ≥ 44 px target and no horizontal scroll.
- With one configured locale nothing is rendered (both headers).
- One switching implementation (core); no copy of it in the host or in peroxid.
- Gates green in core, user and hydroxid; e2e green on the local dev server and on
  `https://daniil.oxiddev.de:2083` after deploy.

## Risks

- `Intl.DisplayNames` is missing in very old browsers → the fallback shows `DE`/`EN`, never breaks.
- Moving `LOCALE_STORAGE_KEY` to core must keep the **same key string** (`oxfe_locale`), or every
  visitor's stored choice is lost; pinned by a unit test.

## Outcome (as built, 2026-10-20)

- **core 0.9.2** (`feature/locale-switch`, `05a0115`): `useLocaleSwitch()` / `localeSwitchKey` / `languageName()` — the host provides its vue-i18n locale ref and ordered locales; `switchTo` stores the choice (`oxfe_locale`, pinned by a test) and **reloads the page**. Core stays free of vue-i18n. 147 unit tests, 97.6 % lines.
- **user** (`feature/peroxid-language-switcher`): the host header's `<select>` now runs on the core composable (unchanged look, same `data-testid`); peroxid has `LanguageOptions.vue` (the Apex-style list, reused as-is in the drawer) and `LanguageMenu.vue` (button with the current language's name + popover, keyboard: Arrow/Enter/Escape, outside click); i18n `peroxid.language.label` en/de. Unit tests mount the real components (no test-utils dependency added). 164 unit tests.
- **Red first:** `tests/e2e/peroxid-language.spec.ts` failed 3/4 before the components existed (the single-language case passes trivially); green after. Touch proof in `peroxid-responsive.spec.ts` on all four device profiles (folded phones: drawer; the unfolded Z Fold: the desktop dropdown). Theme screenshots: [`../reports/language-switch-after/`](../reports/language-switch-after/).
- **Deviation worth knowing — the switch reloads the page.** Found by the e2e: setting the locale alone changes UI copy but not shop-delivered content ("Parking sensor PDC" stayed English until the next fetch) — in **both** headers, so the default header had this gap too. The remedy with Apex parity is a reload after storing the choice; every view then fetches in the new language (the request cache is keyed by language). The default header now behaves the same.
- **Regression:** full chromium suite 71 passed; the two provider-sandbox checkout flows failed only because my dev server ran on port 5174 and the shop's `sPaymentBaseHeadlessReturnOrigins` allows 5173 (shop log: `Return URL rejected (origin_not_allowed): http://localhost:5174/…`). Port 5173 is held by the `oxid-fe-user` dev container. Unrelated to this sprint; not changed.
- **Pitfall recorded:** running the gate's build while e2e targets a running Vite dev server rewrites `public/themes`; Vite's public-file cache then serves `index.html` for the theme CSS (hero without photo, theme tests red). Restart the dev server after a theme build.
- **Open:** release core 0.9.2 → user; hydroxid inherits the header (its `extendMessages` merges per group, the new `language` group arrives untouched) — pin bump + its screenshots after release. `oxid-fe-user/.github/workflows/ci.yml` carries a TEMPORARY `ref: feature/locale-switch` for core until that is merged.
