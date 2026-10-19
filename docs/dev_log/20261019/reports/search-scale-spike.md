# Sprint 13, S1 — spike: can the shop's search carry millions of similar titles?

**Date:** 2026-10-19 · **Decision:** keep `contains`; no index (shop core stays untouched) — see _Decision_.

## What was checked

- **Filter contract** (`graphql-base` `StringFilter`): `equals`, `contains`, `beginsWith`. They become
  `LIKE 'x'`, `LIKE '%x%'`, `LIKE 'x%'` on `OXARTICLES.OXTITLE`.
- **Existing indexes:** `oxarticles` has **no index on `OXTITLE`** in this shop
  (`information_schema.STATISTICS`).
- **Measurement:** a scratch table `zz_probe(OXID, OXTITLE)` in the SDK's MySQL 8 with **500 000**
  near-identical titles ("metall rod 123 mm", "metal rod U-shape - 123 mm", "steel pipe 123 mm"),
  dropped afterwards. The real shop tables were not touched.

## Results (500 000 rows, `LIMIT 5`)

| Predicate                | Index on title | Plan (rows examined)      | Time   |
| ------------------------ | -------------- | ------------------------- | ------ |
| `LIKE '%rod 1100%'`      | no             | full scan (500 000)       | 9 ms   |
| `LIKE 'metall rod 110%'` | no             | full scan (500 000)       | 1 ms   |
| `LIKE '%rod 1100%'`      | yes            | full index scan (498 711) | 45 ms  |
| `LIKE 'metall rod 110%'` | yes            | **range, 369 rows**       | 0.3 ms |

- `contains` examines every row with or without an index; at 5 M rows that is 10× the work, and
  the times above are best cases (many matches end the scan early). A term with few matches scans it all.
- A prefix match is only cheap **with** the index (not available here). Without it, it is a full scan too.
- Depth: `OFFSET 200000` took 10 ms here but the plan still examined ~75 000 rows for a deep offset
  — cost grows with depth, so the page-depth cap is justified.
- `COUNT(*)` on a prefix took 55 ms at 500 000 rows (about 10× at 5 M) — so no totals.

## Decision (revised the same day)

The first decision was `beginsWith` plus an index on `oxarticles.OXTITLE`. **That is withdrawn: the
shop core is not changed, so there is no index.** Without it a prefix match is still a full scan
(table above, row 2) and only loses results ("sensor" no longer finds "Parking sensor PDC"). So:

1. The query stays `title: { contains: $q }`.
2. Overload protection lives in the storefront only: minimum length, debounce, 5 suggestions,
   pages asked as `limit + 1` (no `COUNT`), a depth cap, `%` stripped, the request cache.
3. These reduce the **number and size** of requests. They cannot make one `contains` query
   cheaper: on millions of rows each one scans the table. If that proves too slow, the options
   that do not touch the core are a search engine in front of the shop (e.g. Elasticsearch behind
   a module or service) or an index shipped by a separate module — each a decision for later.

## Limits of this spike

- The probe is the title predicate only. The shop's real `products` query adds active/variant/
  shop conditions and joins; re-check with `EXPLAIN` on the real query once the index exists.
- 500 000 rows, not 5 M. Row counts extrapolate linearly for scans; the indexed prefix plan does not.
