# Sprint 12 — API request caching in `oxid-fe-core` and `oxid-fe-user`

**Date:** 2026-10-19 · **Repos:** `oxid-fe-core` (mechanism), `oxid-fe-user` (policy)
**Binding rules:** [`_engeneering_requirements.md`](./_engeneering_requirements.md) (TDD, SOLID, DRY, Clean code, No overengineering) plus the repo-wide file it extends.

## Ask

Cache API requests so repeated reads (category pages, product pages, front-page streams, search
terms) do not hit the shop again and again.

## Starting point (verified in code)

- `oxid-fe-core/src/api/GraphqlClient.ts` is a thin transport. `execute(query, variables)` always
  does a `fetch` POST. Token and language are injected through providers. There is no cache and
  no in-flight de-duplication.
- Every plugin read goes through `client.execute`. Examples: `plugins/shop/*`,
  `plugins/peroxid/streams.ts` and the search box.
- The response depends on **language** (`Accept-Language`) and on the **token** (prices, basket).

## Design (smallest thing that works)

A **`ResponseCache`** in core, injected into `GraphqlClient`. **Opt-in per call**: a call without
cache options behaves exactly as today.

```ts
client.execute(query, vars); // unchanged: never cached
client.execute(query, vars, { cacheTtlMs: 60_000 }); // cached read
```

- **Key:** `language + token + query + stable-JSON(variables)`. A user never reads another user's
  response, and a language switch never serves the old language.
- **Store:** in-memory `Map` with a maximum entry count (oldest entry evicted first) and per-entry
  expiry. Nothing is written to `localStorage` or `sessionStorage`.
- **In-flight de-duplication:** identical concurrent calls share one `fetch`.
- **Never cached:** errors, and any document that is a `mutation` (the client refuses the cache
  option for it). A successful mutation **clears the whole cache**. This is the simplest correct
  invalidation: after `addToCart` or `login`, nothing stale can survive.
- **Clock:** injectable, so tests never sleep.

## Stories

| #   | Story (test first)                                                                                                                                                                                                                                                                                                        | Repo |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| S1  | `ResponseCache`: get/set, TTL expiry, max entries with eviction, `clear()`, injectable clock. Tests: hit, miss, expiry at TTL boundary, eviction order, clear.                                                                                                                                                            | core |
| S2  | In-flight de-duplication: two concurrent identical requests produce one `fetch`; a rejected request is not cached and the next call retries. Tests with a controllable `fetchFn`.                                                                                                                                         | core |
| S3  | Wire into `GraphqlClient`: `cache` in `GraphqlClientOptions`; `execute(..., { cacheTtlMs })`. Key includes language and token. Tests: language switch misses, other token misses, no option means no caching, a mutation with a TTL option is rejected.                                                                   | core |
| S4  | Invalidate on success of any mutation (`clear()`); tests prove `addToCart` is followed by a fresh read. No `if (operation === …)` in the client. A single place decides "is this a mutation".                                                                                                                             | core |
| S5  | Export, document and release: `docs` section in the core README, version bump, `index.ts` export, `knip` clean.                                                                                                                                                                                                           | core |
| S6  | Policy in the user app: one `cachePolicy.ts` with named TTL constants (e.g. `STREAM_TTL_MS`, `CATALOG_TTL_MS`). Apply to: front-page streams, category and product reads, search suggestions. **Never** to basket, account, checkout or payment calls. Unit test: the listed reads pass a TTL, the excluded reads do not. | user |
| S7  | Create the cache once in `bootstrap.ts` and inject it into the client (DIP). No module-level singleton.                                                                                                                                                                                                                   | user |
| S8  | e2e (Playwright): visit a category, go to a product and back. Assert that the second visit sends **no** category request (count `/graphql` calls). Add to cart, then reload the cart. Assert it is fresh. Switch language and assert new-language data.                                                                   | user |
| S9  | Docs, report, quality gate. `docs/architecture.md` gets a short "request caching" section. Record the measured request-count reduction in `reports/`.                                                                                                                                                                     | both |

## Acceptance

- A cached read called twice within its TTL does one network request. After the TTL it does a second.
- No cached response is ever served across users or languages (tests cover both).
- After any successful mutation the next read hits the network.
- Basket, account, checkout and payment calls are provably never cached.
- Memory is bounded by the entry cap. Nothing is persisted.
- Quality gates are green in both repos.

## Out of scope (deferred, not built)

Persistent or cross-tab cache, stale-while-revalidate, per-entity invalidation, a HTTP/service-worker
cache, cache-size metrics. Each needs a real second use first.

## Risks

- A TTL that is too long shows stale prices or stock. Start short (stream and catalog 60 s,
  search suggestions 30 s). Prices are never cached on the cart or checkout path.
- Token in the key means a login produces a fresh cache for that user. This is intended.

## Outcome (as built, 2026-10-19)

All stories done except the release step (see below).

- **core 0.10.0** (not yet tagged): `ResponseCache` (`remember`, `clear`, TTL, max entries, in-flight sharing, generation guard so a load that started before `clear()` is not stored), `stableStringify`, `GraphqlClient` option `cache` and `execute(q, vars, { cacheTtlMs })`. 92 unit tests, all green.
- **user 0.5.0** (not yet tagged): `plugins/shop/api/cachePolicy.ts` (`CATALOG_READ` 60 s, `SUGGESTION_READ` 30 s), applied to catalog, category, product and front-page stream reads; `createCore` injects one cache. `tests/unit/cachePolicy.spec.ts` fails if basket, account, checkout or payment code opts in.
- **Deviation from the plan:** the e2e proves the category read-back case (`tests/e2e/request-cache.spec.ts`, red without the cache, green with it). "Basket is fresh after adding" and "language switch" are proven by the core unit tests, not by a browser test.
- **Finding:** the guest token arrives right after the first page load and is part of the cache key, so the very first read may be asked again once per session. Documented in `docs/architecture.md`.
- Not measured: a request-count reduction figure across a whole session. The e2e shows 0 repeated category requests after the first way back.
