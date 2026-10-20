/**
 * Sprint 17, S4: measures the quicksearch on the perf entry point and probes its SQL.
 *   npx jiti scripts/perf/search-index/run-benchmark.ts --run none|btree|fulltext --out <raw dir>
 *     [--url http://localhost:8094/graphql/] [--samples 30] [--budget-ms 60000] [--only graphql|probes]
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { runSql } from './mysql';
import { PROBE_PREDICATES, PROBE_TERMS, SCENARIOS } from './scenarios';
import { CSV_HEADER, measureScenario, toCsvRow, type Transport } from './searchBenchmark';
import {
  PREDICATES,
  PROBE_CSV_HEADER,
  STATS_STATEMENT,
  explainStatement,
  parseExplain,
  parseStats,
  probeStatement,
  toProbeCsvRow,
  type ProbeResult,
} from './sqlProbe';

const { values } = parseArgs({
  options: {
    run: { type: 'string' },
    out: { type: 'string' },
    url: {
      type: 'string',
      default: process.env.PERF_GRAPHQL_URL ?? 'http://localhost:8094/graphql/',
    },
    samples: { type: 'string', default: '30' },
    'budget-ms': { type: 'string', default: '60000' },
    'probe-repeats': { type: 'string', default: '3' },
    /** Resume one half of a run, e.g. after a crash: the other half's CSV is left as it is. */
    only: { type: 'string' },
  },
});
if (!values.run || !values.out) {
  throw new Error('--run and --out are required');
}
const run = values.run;
const out = values.out;

const transport: Transport = async (body) => {
  const response = await fetch(values.url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: response.status, json: response.ok ? await response.json() : null };
};

async function measureGraphql(): Promise<void> {
  const rows = [CSV_HEADER];
  for (const scenario of SCENARIOS) {
    const result = await measureScenario(scenario, {
      transport,
      clock: () => performance.now(),
      warmups: 3,
      samples: Number(values.samples),
      budgetMs: Number(values['budget-ms']),
      minSamples: 5,
    });
    rows.push(toCsvRow(run, result));
    console.log(rows[rows.length - 1]);
  }
  writeFileSync(join(out, `${run}.csv`), `${rows.join('\n')}\n`);
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function probe(sql: string): ProbeResult {
  try {
    const plan = parseExplain(runSql(`${explainStatement(sql)};`));
    const timings = Array.from({ length: Number(values['probe-repeats']) }, () =>
      parseStats(runSql(`${sql}; ${STATS_STATEMENT};`)),
    );
    return {
      coldMs: timings[0].ms,
      warmMs: median(timings.slice(1).map((timing) => timing.ms)),
      rowsExamined: timings[timings.length - 1].rowsExamined,
      plan,
      failure: null,
    };
  } catch (error) {
    const message = String((error as { stderr?: string }).stderr ?? error).replace(
      /^mysql: \[Warning\].*\n/m,
      '',
    );
    return {
      coldMs: 0,
      warmMs: 0,
      rowsExamined: 0,
      plan: '',
      failure: message.trim().split('\n')[0],
    };
  }
}

function probeSql(): void {
  const rows = [PROBE_CSV_HEADER];
  for (const term of PROBE_TERMS) {
    for (const predicate of PROBE_PREDICATES) {
      rows.push(
        toProbeCsvRow(run, predicate, term, probe(probeStatement(PREDICATES[predicate], term))),
      );
      console.log(rows[rows.length - 1]);
    }
  }
  writeFileSync(join(out, `${run}-probes.csv`), `${rows.join('\n')}\n`);
}

if (values.only !== 'probes') {
  await measureGraphql();
}
if (values.only !== 'graphql') {
  probeSql();
}
