# Sprint 13 — move the search to the `shop` plugin, safe for ~5 million similar products

**Date:** 2026-10-19 · **Repos:** `oxid-fe-user` (plugins `shop`, `peroxid`), `hydroxid-project` (follow-through); shop backend only checked
**Binding rules:** [`_engeneering_requirements.md`](./_engeneering_requirements.md) (TDD, SOLID, DRY, Clean code, No overengineering) plus the repo-wide file it extends.
**Depends on:** Sprint 12 (`ResponseCache`) for S5.

## Ask

1. Move the search out of the `peroxid` plugin into the `shop` plugin.
2. It must stay fast and must not overload the shop when the catalogue has **millions of products
   with near-identical titles** ("metall rod 100mm", "metall rod 110mm", "metal rod U-shape - 20 mm").

## Starting point (verified in code)

- Search lives in `plugins/peroxid`: `components/SearchBox.vue`, `views/SearchView.vue`, the
  `SEARCH_QUERY` constant in `streams.ts`, the `/search` route, and the `peroxid.search.*` i18n keys.
- It already has some protection: 2-character minimum, 250 ms debounce, 5 suggestions, a sequence
  guard that ignores superseded answers, and pages of 12.
- `SEARCH_QUERY` filters with `title: { contains: $q }`. That is a `LIKE '%q%'` with a **leading
  wildcard**. A database index cannot serve it, so on millions of rows every keystroke is a full
  table scan. **This is the real scale risk.**
- Other gaps for millions of rows: in-flight requests are not cancelled, only ignored; there is no
  cache; the result pager has no depth limit, so a user can request `offset = 5 000 000`.
- `peroxid` already declares `requires: ['shop']` and imports from `../../shop/...`, so `peroxid`
  consuming the shop's search adds no new dependency direction.

## Design

### The move

- New home: `plugins/shop/search/` with `SearchBox.vue`, `SearchView.vue`, `searchQuery.ts` (the
  one query document and the named limits).
- The `shop` plugin registers the `/search` route and the `shop.search.*` i18n keys (en and de).
  `peroxid` keeps no search code, only the header's `<SearchBox />` placement, imported from `shop`.
- The components use `useShopContext()` instead of `usePeroxidContext()`.

### Protecting the shop (rules, each tested)

| Rule                      | How                                                                                                                                                                                                                               |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Query shape**           | _Revised:_ `contains` stays. The shop core gets no index, and a prefix match without one is no cheaper (spike S1).                                                                                                                |
| **Few, small requests**   | Minimum length, debounce, **abort** the superseded request (`AbortController`) so the shop stops working for it, suggestions capped at 5.                                                                                         |
| **No counting**           | Never ask for a total (`COUNT(*)` over millions is expensive). The pager uses "next exists" (fetch `limit + 1`), as it does today.                                                                                                |
| **Bounded depth**         | Cap the page depth (named `MAX_PAGES`). Past the cap the view says "refine your search" and sends no further requests.                                                                                                            |
| **Cache**                 | Suggestions and result pages use Sprint 12's cache with a short TTL, so retyping or going back costs nothing.                                                                                                                     |
| **Near-duplicate titles** | Do not try to "group" 5M similar titles on the client. A shopper narrows by typing more ("metall rod 110"), which a prefix match supports. Refinement hint at the depth cap. Real faceting needs a search engine and is deferred. |

## Downstream: peroxid, themes and HydroXid (verified in code)

The move changes what `peroxid` exports, so everything built on it must follow. Checked in
`/hydroxid-project` and in `oxid-fe-user`:

| Place                                                                                          | Impact                                                                                                                                                                                                                                                                                                                                                                             |
| ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `plugins/peroxid/index.ts`                                                                     | Loses the `/search` route (`routes` becomes empty, so remove the key). Keeps the header's `<SearchBox />` placement, imported from `shop`. `requires: ['shop']` already guarantees the route exists. Header and footer (`/search` link) keep working unchanged.                                                                                                                    |
| `peroxid` i18n (`peroxid.search.*`)                                                            | Keys move to `shop.search.*` in en and de. `peroxid.footer.search` (the footer link label) stays in `peroxid`.                                                                                                                                                                                                                                                                     |
| `hydroxid-project/plugins/hydroxid/index.ts`                                                   | Spreads `...peroxid`, so it inherits the change with no code edit **unless** it relied on `peroxid.routes` (it does not declare routes itself). It keeps `name: 'peroxid'` for the message namespace; search copy now comes from `shop`, so HydroXid copy overrides for search (none today) would have to target `shop.search`.                                                    |
| `hydroxid-project/tests/unit/plugins.spec.ts`                                                  | Two assertions break by design: `hydroxid.routes toBe peroxid.routes` (search route) and `en.search toEqual original.search`. Rewrite them to the new truth (no search route in either; search messages come from `shop`). The "keeps everything of peroxid" test is renamed accordingly.                                                                                          |
| `hydroxid-project/package.json`                                                                | Pins `@dantweb/oxid-fe-user#v0.4.1`. It gets the new search only after `oxid-fe-core` and `oxid-fe-user` are released and the pin is bumped. Release order: core, then user (tag), then HydroXid.                                                                                                                                                                                  |
| Themes (`oxid-fe-user/resources/themes/*`, `hydroxid-project/themes/*`)                        | No theme contains search CSS (the styles live in the component and use the `--oxfe-*` tokens), so no code change is expected. This is **proven, not assumed**: screenshots of the search box, suggestion list and results page in every theme (peroxid, default, dark, apex, hydroxid-vibrant, light-red, dark-ocean). A theme fix is made only where a screenshot shows a defect. |
| Instance configs (`hydroxid-project/instances/*/oxid-config.yaml`, `oxid-fe-user/instances/*`) | The comment "header, front page, search" becomes inaccurate; update the wording. `shop` must be enabled in each (already required). Add a check that every instance enabling `peroxid` also enables `shop`.                                                                                                                                                                        |
| Docs                                                                                           | `oxid-fe-user/docs/layout-plugins.md`, `docs/architecture.md`, `hydroxid-project/README.md`, `hydroxid-project/docs/architecture.md` and `docs/demo-localisation.md` name search as part of peroxid; correct them.                                                                                                                                                                 |
| Stable selectors                                                                               | The `data-testid` values (`pxd-search*`, `pxd-suggestions`, `pxd-results*`) are **kept**. Renaming them would break the e2e suites of both repos for no gain.                                                                                                                                                                                                                      |
| Default header (`src/components/AppHeader.vue`)                                                | Has no search today. Out of scope. Once search lives in `shop` it can be added later without touching `peroxid`.                                                                                                                                                                                                                                                                   |

## Stories

| #   | Story (test first)                                                                                                                                                                                                                                                                                                                                                                                      |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | **Spike, time-boxed.** Check the shop's `StringFilter` (does `beginsWith` exist?), check whether `OXTITLE` is indexed, and time `contains` against a prefix match on a seeded table of ≥ 500 000 rows with near-identical titles. Record `EXPLAIN` output and timings in `reports/`. Decide the query (prefix, or `contains` plus a recommended backend index). The decision is written down before S4. |
| S2  | **Move without behaviour change.** First, characterization tests on the current behaviour (min length, debounce, cap of 5, route, i18n keys, `peroxid` header still shows the box). Then move the files and rewire imports. Tests stay green throughout; `peroxid` has no search code left; `knip` is clean.                                                                                            |
| S3  | Rename the i18n keys `peroxid.search.*` → `shop.search.*` (en and de) and the route ownership. Test: the `shop` plugin lists `/search`, the `peroxid` plugin does not; the existing e2e `peroxid.spec.ts` search cases pass unchanged.                                                                                                                                                                  |
| S4  | Apply the S1 decision to `searchQuery.ts` (query document and its variables). The unit test pins the document, like the existing `SEARCH_QUERY` test.                                                                                                                                                                                                                                                   |
| S5  | Load protection: abort the superseded request (extend the request path with an `AbortSignal`; one place), `limit + 1` for "next exists", `MAX_PAGES` with the refine message, cache TTL from Sprint 12. Tests: rapid typing makes one request and aborts the earlier ones, depth cap stops requests, a second identical search is served from cache.                                                    |
| S6  | e2e (Playwright), on a shop seeded with a large set of near-identical titles: typing quickly sends few requests; suggestions are ≤ 5; paging stops at the cap with the refine message; an exact narrow term ("metall rod 110") returns the right products. Screenshots in `reports/`.                                                                                                                   |
| S7  | **Downstream follow-through (peroxid, themes).** Update the peroxid plugin, tests and instance comments as in the table above. Run the full `oxid-fe-user` e2e and the responsive projects; capture search screenshots per theme into `reports/` and fix a theme only where a screenshot shows a defect.                                                                                                |
| S8  | **HydroXid.** After core and user are released: bump the pins in `hydroxid-project/package.json`, rewrite the two broken unit assertions, update its docs and instance comments, and run its unit and e2e tests (`project`, `live`, `localisation-live`) against the three hydroxid themes. Add the search screenshots for `vibrant`, `light-red` and `dark-ocean`.                                     |
| S9  | Docs, report, quality gate. `docs/plugin-contract.md` and `docs/layout-plugins.md` updated (search belongs to `shop`); an ADR if the S1 decision changes the backend contract.                                                                                                                                                                                                                          |

## Acceptance

- `grep -ri search plugins/peroxid` finds only the `<SearchBox />` placement and its import from `shop`.
- Search works as before for a normal user (suggestions, results page, paging, `noindex`).
- On the large seeded set the query uses an index (or the sprint documents exactly what the
  backend needs) and typing does not produce a queue of requests.
- No request asks for a total count or an offset beyond the page cap.
- `peroxid`, every theme of both repos and all three HydroXid instances show a working search; screenshots are in `reports/`.
- `hydroxid-project` builds against the released `oxid-fe-user`, with its unit and e2e tests green and no assertion weakened to make it pass.
- Quality gates are green in `oxid-fe-core`, `oxid-fe-user` and `hydroxid-project`; e2e passes.

## Out of scope (deferred, not built)

Faceted search (dimension/shape filters), typo tolerance, relevance ranking, an Elasticsearch
integration, search in the default header, a pluggable "search provider" interface, search analytics. Revisit after S1's numbers if the
backend is the limit.

## Risks

- If `beginsWith` is unavailable, a backend change (GraphQL filter and DB index in the shop) is the
  right fix and belongs to the shop module, not the frontend. S1 reports it and does not guess.
- A prefix match finds "metall rod…" but not "…rod metall". This is accepted at this scale and
  stated in the docs.

## Outcome (as built, 2026-10-19)

All stories done except the HydroXid pin bump, which waits for the release (see below).

- **S1:** [`reports/search-scale-spike.md`](../reports/search-scale-spike.md) — `beginsWith` exists; `oxarticles` has **no `OXTITLE` index**; with an index the prefix query examined 369 of 500 000 rows (0.3 ms), `contains` scans everything.
- **S2/S3:** search moved to `plugins/shop/search/`; `/search` route and `shop.search.*` copy belong to `shop`; `peroxid` only places the box. The 28 existing peroxid e2e tests (desktop, iPhone 17 Pro, Galaxy S24) passed before and after the move.
- **S4 (revised):** the query was switched to `beginsWith` and **reverted to `contains`** after the decision that the shop core gets no index — a prefix match without an index is still a full scan and only loses recall. The original "sensor" e2e tests are unchanged and green.
- **S5:** `searchApi.ts` — `normalizeTerm` (strips `%`), `fetchSuggestions`, `fetchResultsPage` (asks `limit + 1`, no counting), `MAX_PAGES = 20` then a "refine" message, cache policy. **Deviation:** the planned request _abort_ was dropped: PHP finishes the SQL query regardless of an aborted request, and aborting a request shared through the in-flight cache could fail an identical later search. Superseded answers are still ignored.
- **S6:** `tests/e2e/search-scale.spec.ts` simulates an endless catalogue at the browser (one request for fast typing, 5 suggestions, wildcards stripped, paging stops at offset 228, cache on back). The database is not seeded; its behaviour is covered by the spike.
- **S7:** `tests/e2e/search-evidence.spec.ts` + screenshots in `reports/search-themes/` (peroxid, default, dark, apex).
- **S8:** HydroXid tests/docs/instance comments updated, `tests/e2e/search.spec.ts` for all three instances (screenshots in `hydroxid-project/docs/reports/`). Verified against the **local** `oxid-fe-core` and `oxid-fe-user` (temporary symlinks, since removed).
- **S9:** docs updated (`layout-plugins.md`, `architecture.md`, `README.md`); versions set to user 0.5.0.

### Still open (needs a decision or an action outside this repo)

1. **Scale limit:** with `contains` and no index, every search query scans the product table. The storefront limits the number and size of requests but cannot make a query cheaper. If it is too slow at your catalogue size, the options that leave the core alone are a search engine in front of the shop or an index shipped by a separate module.
2. **Release order** (tags are outward-facing, so not done): tag `oxid-fe-core` v0.10.0, then `oxid-fe-user` v0.5.0, then bump the two pins in `hydroxid-project/package.json`. Until then HydroXid's new test "has no search of its own" fails against the pinned v0.4.1.
