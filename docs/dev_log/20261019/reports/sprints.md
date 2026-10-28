# Sprints planned for 2026-10-19

**Repos:** `oxid-fe-core`, `oxid-fe-user`

## Sprint 1 — API request caching in `oxid-fe-core` and `oxid-fe-user`

### Ask

Add caching for API requests in both `oxid-fe-core` and `oxid-fe-user`.

### Open points to settle in the spec

- What is cached: reads only (queries), never mutations or anything user/session-specific unless keyed per session.
- Where the cache lives: core provides the mechanism (cache layer around the API client); user wires the policy per instance.
- Key, TTL and invalidation: key by operation + variables (+ language/currency/session scope); TTL per query type; invalidate on relevant mutations (e.g. basket, login/logout).
- In-flight de-duplication of identical concurrent requests.
- Tests: hit, miss, expiry, invalidation, per-user isolation.

## Sprint 2 — move the search plugin from the peroxid plugin to the shop plugin

### Ask

Move the search plugin out of the peroxid plugin and into the shop plugin. The search must hold up
when a shop has **~5 million products with near-identical names** (e.g. "metall rod 100mm",
"metall rod 110mm", "metal rod U-shape - 20 mm"), so it must not be overloaded.

### Design constraints (scale)

- Server-side search only. No client-side filtering and no loading of full product lists.
- Debounce input, with a minimum query length and cancellation of superseded requests.
- Small, paginated results (suggestions capped, e.g. 5-10). No unbounded result sets.
- Cache responses per normalized query (builds on Sprint 1) and de-duplicate in-flight requests.
- Near-duplicate names: group or rank so 5M similar titles stay usable. Offer refinement (facets such as dimension/shape) rather than a long flat list.
- Backend capability to confirm: whether the shop search query supports pagination and limits cheaply at this scale, or needs an indexed backend (e.g. Elasticsearch).

### Stories (draft)

| #   | Story                                                                                       |
| --- | ------------------------------------------------------------------------------------------- |
| S1  | Spec: search plugin contract in the shop plugin and the scale rules above                   |
| S2  | Move the search plugin code from the peroxid plugin to the shop plugin; peroxid consumes it |
| S3  | Load protection: debounce, min length, cancellation, capped and paginated results, cache    |
| S4  | Near-duplicate handling: grouping or ranking and refinement                                 |
| S5  | Tests (unit and e2e), including a large-catalogue scenario                                  |
| S6  | Report, docs, quality gate                                                                  |

### Note

The ask said "remove ... from peroxid plugin to shop plugin". I read that as **move**.

## Detailed sprints (written later the same day; Sprint 13 also covers the peroxid plugin, themes and the peroxid repo)

- Rules for both: [`../sprints/_engeneering_requirements.md`](../sprints/_engeneering_requirements.md)
- [Sprint 12 — API request caching](../sprints/sprint-12-api-request-caching.md)
- [Sprint 13 — search to the shop plugin, safe at 5M products](../sprints/sprint-13-search-plugin-to-shop.md)
