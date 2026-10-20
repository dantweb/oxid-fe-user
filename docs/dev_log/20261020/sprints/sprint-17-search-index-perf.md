# Sprint 17 — measuring the performance gain from indexes on `oxarticles.OXTITLE` / `OXSHORTDESC` for a large catalogue

**Date:** 2026-10-20 · **Repos:** `oxid-fe-user` (perf tooling under `scripts/perf/`, tests, report); SDK MySQL (cloned DB only)
**Binding rules:** [`../../20261019/sprints/_engeneering_requirements.md`](../../20261019/sprints/_engeneering_requirements.md) (TDD, SOLID, DRY, Clean code, No overengineering) and the repo-wide file it extends.
**Follows up:** Sprint 13 spike [`20261019/reports/search-scale-spike.md`](../../20261019/reports/search-scale-spike.md) (500 000 rows, scratch table, title predicate only). This sprint measures the **real** GraphQL query on **5 000 000** real `oxarticles` rows.

**Definition of Done (sprint-level):** `reports/search-index-perf/report.md` shows, with charts and raw CSV, the quicksearch response times on 5 M rods for three runs: no index, B-tree index, and FULLTEXT index. It also gives a conclusion that is reproducible from one documented command sequence.

## Ask

1. Populate the shop with 5 M near-identical articles. The matrix is "metal rod X mm length Y mm diameter"
   (X 1–1000, Y 1–100) × shapes (straight, L, U, T, S) × 17 materials
   (Zn, Fe, Co, Mn, Ni, Mg, Ti, Al, ZnFe, FeCo, FeMo, FeMoCo, CoMn, AlTi, AlMg, AlTiMg, TiMg).
2. Run GraphQL API tests that send exactly what the quicksearch sends, and measure the response time.
3. Add indexes on `OXTITLE` and `OXSHORTDESC` in `oxarticles`.
4. Run the tests again and measure.
5. Write a report with charts.

## Decisions (agreed with the user, 2026-10-20)

| Question     | Decision                                                                                                                                                                                                                                    |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5 M of 8.5 M | The full matrix is 1000 × 100 × 5 × 17 = **8 500 000**. A **seeded random sample of exactly 5 000 000 distinct combinations** is taken: reproducible, and every length, diameter, shape and material still appears.                         |
| Which index  | **Three runs:** `none` → `btree` (`KEY (OXTITLE)`, `KEY (OXSHORTDESC)`) → `fulltext` (`FULLTEXT (OXTITLE)`, `FULLTEXT (OXSHORTDESC)`). Each run uses the same GraphQL suite plus SQL probes. No shop core / GraphQL module code is changed. |
| Where        | A **cloned DB `example_perf`**. The demo shop on `example` is never touched.                                                                                                                                                                |
| Report       | Markdown + SVG charts + raw CSV in `20261020/reports/search-index-perf/`.                                                                                                                                                                   |

## Starting point (verified 2026-10-20)

- Quicksearch (`plugins/shop/search/searchQuery.ts`) sends
  `products(filter: { title: { contains: $q } }, pagination: { offset, limit })`. Suggestions use
  `limit 5, offset 0`. Results pages use `limit 13` (`PAGE_SIZE + 1`) and `offset = page × 12`, capped at 20 pages.
- `graphql-base` `StringFilter`: `contains` → `OXTITLE LIKE '%q%'`, `beginsWith` → `LIKE 'q%'`.
  **A B-tree index cannot serve a leading wildcard**, so the expected `btree` gain for the quicksearch is ~0.
  This is the hypothesis under test, not an assumption to hide.
- The quicksearch **never filters on `OXSHORTDESC`**. Its index is measured only through SQL probes, which
  show what it would give the classic OXID search that uses `OXSHORTDESC LIKE '%q%'`.
- `oxarticles` today: 242 rows, **no index** on `OXTITLE` / `OXSHORTDESC`. Both columns are `varchar(255)`.
- MySQL 8.0: `innodb_buffer_pool_size` = **128 MB**, `innodb_ft_min_token_size` = **3**, `local_infile` = OFF,
  `secure_file_priv` = `/var/lib/mysql-files/`.
- `config.inc.php` hard-codes `dbName = 'example'`, and the single Apache vhost serves `/var/www/source/`.
- Disk: 53 GB free (89 % used).

## Out of scope

- Changing the GraphQL search to `MATCH … AGAINST`, or switching the storefront to `beginsWith`. Their potential is
  **measured as SQL probes only**, and the decision goes to a later sprint.
- Elasticsearch or any search engine in front of the shop.
- Indexes on the other language columns (`OXTITLE_1`, …). Only language 0 is measured.
- Tuning MySQL (buffer pool, ngram parser, `ft_min_token_size`). The current config is recorded in the report, not changed.
- Categories, variants, images, prices beyond one flat value, and `oxartextends` rows. None of these are part of the title filter.
- Load or concurrency testing. Requests are sequential and single-client, as one shopper typing.

## Risks & unknowns

- **Disk:** a wide `oxarticles` row is ~1–2 KB, so 5 M rows plus indexes plus the TSV is estimated at 8–15 GB, on 53 GB free.
  _De-risk:_ S1 loads 100 000 rows first, measures bytes/row, and stops if the extrapolation exceeds 25 GB.
- **Second entry point to the cloned DB:** OXID's `tmp/` caches (DI container, views, lang) are shared by both entry points.
  _De-risk:_ the S1 spike proves `:8094` reads `example_perf` while `:443` still reads `example`. The fallback is a time-boxed config
  swap with `tmp/` cleared before and after, recorded in `status.md`.
- **128 MB buffer pool vs. GBs of data:** cold and warm timings will differ a lot. _Handling:_ every run does warm-up
  requests first and reports warm p50/p95. The first (cold) request is reported separately, not mixed in.
- **FULLTEXT and 2-letter materials:** with `ft_min_token_size=3`, `Zn`, `Fe`, `Co`, `Mn`, `Ni`, `Mg`, `Ti` and `Al` are never indexed,
  so `MATCH` returns nothing for them. The report states this as a finding, and the term set includes these terms on purpose.
- **Index build time on 5 M rows** (minutes; FULLTEXT is slowest). It is recorded as a result (build time and index size), not treated as a blocker.

---

## Story 1 — Spike: a cloned `example_perf` DB served on its own port

**Why:** every later measurement must hit 5 M rows through the real GraphQL stack without touching the demo shop.
**Estimate:** S

**Tests first (TDD):**

- `tests/perf/perfEnvironment.spec.ts` (Vitest, `describe.runIf(process.env.PERF_GRAPHQL_URL)`)
  - `perf endpoint answers the quicksearch query`: a `products` query with `contains: "a"` returns an array.
  - `perf endpoint reads example_perf, not example`: the `products` count for a marker title that exists only in `example_perf` is 1.
  - `demo endpoint does not see the perf marker`: the same query against `:443` returns 0.

**Implementation steps:**

1. `scripts/perf/search-index/db-clone.sh`: `mysqldump example | mysql example_perf`, including the `oxv_*` views. Then insert one marker article.
2. In `config.inc.php`, read the DB name from `getenv('OXID_DB_NAME') ?: 'example'`. The default keeps current behaviour.
3. Add a second vhost on `:8094` in `containers/httpd/project.conf` with `SetEnv OXID_DB_NAME example_perf`, and expose the port in compose.
4. Load 100 000 generated rows (S2/S3 code, small run), measure `data_length + index_length` per row, and write the extrapolation to the
   report's _Environment_ section.

**SOLID/Clean check:**

- SRP: the clone script only copies a DB; it does not load or measure.
- DRY: reuses `SEARCH_QUERY` from `plugins/shop/search/searchQuery.ts`, never a copy.
- No overengineering: one env var, no multi-tenant config layer.

**DevOps gate:** `npm run lint`, `npm run type-check`, `npm run knip`, `npm run test:coverage`. The perf specs are skipped without `PERF_GRAPHQL_URL`, so CI stays green.

**Definition of Done:** `PERF_GRAPHQL_URL=https://localhost.local:8094/graphql/ npx vitest run tests/perf` is green. The disk extrapolation is below 25 GB and is written down.

---

## Story 2 — Seeded catalogue generator (pure, fully unit-tested)

**Why:** 5 M rows must be reproducible bit-for-bit and match the matrix the user asked for.
**Estimate:** M

**Tests first (TDD):** `tests/unit/perf/rodCatalogue.spec.ts`

- `matrix size is 1000 × 100 × 5 × 17 = 8 500 000`
- `combination(index) and indexOf(combination) round-trip at 0, 1, last and a random index`
- `sample(seed, 5_000_000) yields exactly 5 000 000 distinct indexes`: asserted on a small analogue (`sample(seed, 50)` of 85), plus one full run in the `perf` suite.
- `same seed → same sample; different seed → different sample`
- `every length, diameter, shape and material appears in the 5 M sample` (perf suite, counted in one pass)
- `title of a straight rod is "metal rod Fe 120mm length 8mm diameter"`
- `title of a shaped rod is "metal rod U-shape AlTiMg 3mm length 1mm diameter"`
- `short description names material, shape, length and diameter in prose`
- `OXID is 32 lowercase hex and stable for the same combination`
- `OXARTNUM is "ROD-" + zero-padded index`, so the rows can be told apart from the demo catalogue.
- `toTsvRow escapes tab, newline and backslash` (MySQL `LOAD DATA` defaults).

**Implementation steps:**

1. `scripts/perf/search-index/rodCatalogue.ts`: the constants `LENGTHS_MM`, `DIAMETERS_MM`, `SHAPES`, `MATERIALS`, plus `combination(i)` and `indexOf(c)`.
2. `sample(seed, n)`: partial Fisher–Yates over a `Uint32Array(8_500_000)` (34 MB) with mulberry32. It is exact and has no retries.
3. `toArticleRow(c)` and `toTsvRow(row)`: only the columns the product list needs (`OXID, OXSHOPID=1, OXACTIVE=1, OXARTNUM,
OXTITLE, OXSHORTDESC, OXPRICE, OXSTOCK, OXSTOCKFLAG=1, OXINSERT, OXTIMESTAMP, OXPARENTID=''`).
4. `generate-tsv.ts` CLI: streams 5 M rows in 500 000-row chunk files into the mysql container's `/var/lib/mysql-files/rods/`. It runs with
   `node --experimental-strip-types` (Node 22).

**SOLID/Clean check:**

- SRP: `rodCatalogue` knows the matrix and the row format. It does no I/O. The CLI only streams to files.
- DIP: the CLI receives the output directory and seed as arguments. No hidden paths.
- No overengineering: there is no "generic catalogue generator". Rods are the only requirement.

**DevOps gate:** lint, type-check, knip (with the perf entry points added to `knip.json`), test:coverage ≥ 90 % for `rodCatalogue.ts`, build.

**Definition of Done:** `generate-tsv.ts --seed 20261020` produces 10 chunk files whose total line count is 5 000 000. Running it twice gives identical files (`sha256sum`).

---

## Story 3 — Load 5 M rows into `example_perf`

**Why:** the measurement needs the rows in the real `oxarticles` table, read through the real `oxv_oxarticles_*` views.
**Estimate:** S

**Tests first (TDD):**

- `tests/unit/perf/loadSql.spec.ts`
  - `load statement targets example_perf.oxarticles and lists the TSV columns in row order`
  - `reset statement deletes only OXARTNUM LIKE 'ROD-%'`, so a re-run is idempotent and the demo rows survive.
- `tests/perf/loadedCatalogue.spec.ts` (perf suite)
  - `example_perf holds 5 000 000 ROD- articles`
  - `GraphQL finds "metal rod T-shape FeMoCo 999mm length 99mm diameter" iff the sample contains it` (checked against `indexOf`/sample).

**Implementation steps:**

1. `loadSql.ts`: build the `DELETE` + `LOAD DATA INFILE` statements per chunk with `SET unique_checks=0`, then `ANALYZE TABLE`.
2. `load.sh`: run the chunks in order and log rows/s and elapsed time to `reports/search-index-perf/load.log`.
3. Record the table size after the load (`information_schema.TABLES`).

**SOLID/Clean check:** SRP — the SQL builder is pure and the shell script only executes. DRY — the column list comes from the S2 row format, never retyped.

**DevOps gate:** as S2.

**Definition of Done:** the count is 5 000 000, the GraphQL spot check passes, and the load time and table size are in `load.log`.

---

## Story 4 — Quicksearch benchmark harness (GraphQL + SQL probes)

**Why:** "as if the request comes from the quicksearch" means the same query document, variables and limits, measured the same way every run.
**Estimate:** M

**Tests first (TDD):** `tests/unit/perf/searchBenchmark.spec.ts`

- `request body is SEARCH_QUERY with the suggestion variables { q, limit: SUGGESTION_LIMIT, offset: 0 }`
- `results-page request uses limit PAGE_SIZE + 1 and offset page × PAGE_SIZE`
- `terms are normalized with normalizeTerm before sending`. This reuses the storefront function, so the benchmark cannot drift.
- `warm-up requests are excluded from the samples; the first request is reported as cold`
- `percentile(samples, 50|95|99) matches hand-computed values` (odd, even, single sample)
- `a GraphQL error or a non-200 marks the scenario failed instead of timing it`
- `CSV row has run, scenario, term, limit, offset, n, cold_ms, p50, p95, p99, min, max, rows_returned`

**Scenarios (fixed term set, `scenarios.ts`):**

| Scenario               | Term(s)                                                                      | Why                                              |
| ---------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------ |
| suggest-broad          | `metal rod`                                                                  | matches everything: the scan ends early          |
| suggest-typing         | `me`, `met`, `meta`, `metal`, `metal r` … (one per keystroke after debounce) | the quicksearch keystroke path                   |
| suggest-selective      | `FeMoCo 999mm length 99mm`                                                   | few matches: worst case for a scan               |
| suggest-shape          | `U-shape AlTi`                                                               | mid selectivity                                  |
| suggest-short          | `Zn`, `Ti`                                                                   | 2-char material: the FULLTEXT blind spot         |
| suggest-miss           | `titanium bar`                                                               | zero matches: full scan, the absolute worst case |
| page-first / page-last | `L-shape`, pages 0 and 19                                                    | depth cost up to the `MAX_PAGES` cap             |

Each scenario: 3 warm-up requests, then 30 timed sequential requests (`performance.now()` around `fetch`), with the client-side response cache **off**.

**SQL probes (same terms, `EXPLAIN ANALYZE` + timing, per run):** `OXTITLE LIKE '%q%'` (= contains), `OXTITLE LIKE 'q%'` (= beginsWith),
`OXSHORTDESC LIKE '%q%'`, and in the `fulltext` run `MATCH(OXTITLE) AGAINST ('+q' IN BOOLEAN MODE)`. Each probe records rows examined, the access type and the time.

**Implementation steps:**

1. `searchBenchmark.ts`: `buildRequest`, `measureScenario`, `percentile`, `toCsvRow`. `fetch` is injected, so the tests use a fake clock and a fake transport.
2. `sqlProbe.ts`: run the probes through `docker compose exec mysql` and parse `EXPLAIN ANALYZE` (rows, time).
3. `run-benchmark.ts --run none|btree|fulltext`: writes `reports/search-index-perf/raw/<run>.csv` and `<run>-probes.csv`.

**SOLID/Clean check:**

- SRP: one module measures, one formats, one probes SQL. None knows about charts.
- DIP: the transport (`fetch`) and the clock are parameters.
- DRY: `SEARCH_QUERY`, `SUGGESTION_LIMIT`, `PAGE_SIZE`, `MAX_PAGES` and `normalizeTerm` are imported from `plugins/shop/search/` and never copied.

**DevOps gate:** as S2.

**Definition of Done:** `run-benchmark.ts --run none` against `:8094` writes both CSVs with all scenarios and no failures.

---

## Story 5 — Index migrations and the three measured runs

**Why:** steps 2–4 of the ask: before, after B-tree, after FULLTEXT, all on the same data and same harness.
**Estimate:** M (mostly wall-clock: index builds and runs)

**Tests first (TDD):**

- `tests/unit/perf/indexMigrations.spec.ts`
  - `btree up adds KEY OXTITLE_PERF (OXTITLE) and KEY OXSHORTDESC_PERF (OXSHORTDESC) with ALGORITHM=INPLACE, LOCK=NONE`
  - `fulltext up adds FULLTEXT indexes on each column; down drops exactly what up added`
  - `every statement names example_perf explicitly`, so it can never run against `example`.
- `tests/perf/indexState.spec.ts` (perf suite): after each `up`, `information_schema.STATISTICS` shows the expected index type. After `down`, it is gone.

**Implementation steps:**

1. `indexMigrations.ts` + `migrate.sh up|down btree|fulltext`. Record build time and index size into `raw/indexes.csv`.
2. Run `none` → `btree up` → run `btree` → `btree down` → `fulltext up` → run `fulltext` → `fulltext down`.
   Restart the mysql container before each run, so the cold numbers are comparable, then warm up.
3. Record the environment (MySQL version, buffer pool, ft settings, host CPU/RAM, row count) in `raw/environment.json`.

**SOLID/Clean check:** SRP — migrations change the schema only; the benchmark is untouched between runs, so the only variable is the index.

**DevOps gate:** as S2.

**Definition of Done:** `raw/none.csv`, `raw/btree.csv`, `raw/fulltext.csv`, the three probe CSVs, `indexes.csv` and `environment.json` exist and are complete.

---

## Story 6 — Report with charts

**Why:** step 5 of the ask: a decision-ready answer to "do these indexes make the quicksearch faster on 5 M rows?"
**Estimate:** S

**Tests first (TDD):** `tests/unit/perf/reportCharts.spec.ts`

- `grouped bar chart has one group per scenario and one bar per run, with heights proportional to p50`
- `p95 is drawn as a whisker above each bar`
- `y-axis uses a log scale when max/min > 100` (scans vs. index lookups span orders of magnitude)
- `every bar has a <title> with the exact value`, readable without colour (labels, not only a legend)
- `SVG has a white background and fixed colours`, so it renders the same in GitHub light and dark

**Charts (`reports/search-index-perf/charts/`):**

1. `graphql-p50-p95.svg` — quicksearch GraphQL p50/p95 per scenario × run (none / btree / fulltext).
2. `sql-probes.svg` — SQL time per predicate (contains, beginsWith, shortdesc contains, MATCH) × run.
3. `rows-examined.svg` — rows examined per probe (log), which shows _why_ the times differ.
4. `index-cost.svg` — build time and size of each index.

**Report (`reports/search-index-perf/report.md`):** the question, setup and environment, dataset (matrix, seed, sample, size), method,
results (tables + charts), findings (including the FULLTEXT 2-letter blind spot and the `OXSHORTDESC` index being unused by the
quicksearch), conclusion and recommendation, limits, and how to reproduce (the exact command sequence) and clean up (`DROP DATABASE example_perf`, TSV removal).

**Implementation steps:**

1. Load the `dataviz` skill, then write `reportCharts.ts`: hand-written SVG with no chart library (no present need for one).
2. `build-report.ts` reads `raw/*.csv` and writes the charts and the tables block of `report.md`. The prose is written by hand from the numbers.
3. Add an entry to `status.md`.

**SOLID/Clean check:** SRP — chart rendering is pure (data in → SVG string out); the CLI does I/O.

**DevOps gate:** as S2, plus the full `npm run lint` / `type-check` / `knip` / `test:coverage` / `build` before the commit.

**Definition of Done:** `report.md` renders on GitHub with 4 charts, and every number in its prose traces to a raw CSV.

---

## Suggested order

1. **S1** — highest risk (second entry point, disk). Everything depends on it.
2. **S2** — pure and fast to TDD. Its 100 000-row output feeds S1's disk check.
3. **S3** — needs S1 + S2.
4. **S4** — can be built in parallel with S3 against the 100 000-row DB, then pointed at 5 M.
5. **S5** — needs S3 + S4. It is mostly wall-clock time.
6. **S6** — needs S5's CSVs. The chart renderer can be TDD'd earlier with fixture CSVs.

## Expected outcome (hypothesis to confirm or refute)

- `btree`: no gain for the quicksearch (`contains`, leading wildcard). There is a large gain only for the `beginsWith` probe.
- `fulltext`: no gain for the GraphQL quicksearch (it still sends `LIKE`). There is a large gain for the `MATCH` probe on ≥3-char terms and **no results** for 2-letter materials.
- The recommendation in S6 is decided by the numbers, not by this hypothesis.
