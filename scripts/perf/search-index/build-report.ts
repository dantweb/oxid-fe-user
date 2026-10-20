/**
 * Sprint 17, S6: turns the raw CSVs of the three runs into the report's charts and tables.
 *   npx jiti scripts/perf/search-index/build-report.ts --raw test-results/performance/raw \
 *     --dir docs/dev_log/20261020/reports/search-index-perf [--runs none,btree,fulltext]
 * Reads the raw CSVs (working data), writes charts/*.svg next to the report and tables.md to the raw dir;
 * the report's prose is written from these numbers by hand.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { groupedBarChart } from './reportCharts';
import {
  comparisonTable,
  graphqlChart,
  indexCostTable,
  parseCsv,
  probeChart,
  type CsvRow,
} from './reportData';

const { values } = parseArgs({
  options: {
    raw: { type: 'string' },
    dir: { type: 'string' },
    runs: { type: 'string', default: 'none,btree,fulltext' },
  },
});
if (!values.raw || !values.dir) {
  throw new Error('--raw and --dir are required');
}
const raw = values.raw;
const dir = values.dir;
const runs = values.runs.split(',');

function rowsOf(suffix: string): CsvRow[] {
  return runs.flatMap((run) => {
    const file = join(raw, `${run}${suffix}.csv`);
    return existsSync(file) ? parseCsv(readFileSync(file, 'utf8')) : [];
  });
}

const charts = {
  'graphql-p50-p95': graphqlChart(rowsOf(''), runs),
  'sql-probes-time': probeChart(rowsOf('-probes'), runs, 'warm_ms'),
  'sql-probes-rows': probeChart(rowsOf('-probes'), runs, 'rows_examined'),
};
mkdirSync(join(dir, 'charts'), { recursive: true });
const tables: string[] = [];
for (const [name, chart] of Object.entries(charts)) {
  writeFileSync(join(dir, 'charts', `${name}.svg`), groupedBarChart(chart));
  tables.push(`### ${chart.title} (${chart.unit})\n\n${comparisonTable(chart)}\n`);
}
const indexes = join(raw, 'indexes.csv');
if (existsSync(indexes)) {
  tables.push(`### Index cost\n\n${indexCostTable(parseCsv(readFileSync(indexes, 'utf8')))}\n`);
}
writeFileSync(join(raw, 'tables.md'), tables.join('\n'));
console.log(`charts written to ${dir}/charts, tables to ${raw}/tables.md`);
