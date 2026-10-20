import { PAGE_SIZE, SUGGESTION_LIMIT } from '../../../plugins/shop/search/searchApi';
import { formatValue, type Bar, type BarGroup, type ChartSpec } from './reportCharts';

/** Sprint 17, S6: raw CSV rows → chart specs and Markdown tables. Pure. */
export type CsvRow = Record<string, string>;

function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (quoted && char === '"' && line[i + 1] === '"') {
      field += '"';
      i++;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      fields.push(field);
      field = '';
    } else {
      field += char;
    }
  }
  fields.push(field);
  return fields;
}

export function parseCsv(text: string): CsvRow[] {
  const [header, ...lines] = text.trim().split('\n');
  const names = splitCsvLine(header);
  return lines.map((line) => {
    const fields = splitCsvLine(line);
    return Object.fromEntries(names.map((name, i) => [name, fields[i] ?? '']));
  });
}

export function scenarioLabel(scenario: string, term: string, page: number | null): string {
  return `${scenario} “${term}”${page === null ? '' : ` p${page + 1}`}`;
}

/** How each run is named for readers: the legend and the table headers. */
const RUN_LABELS: Record<string, string> = {
  none: 'no index',
  btree: 'B-tree index',
  fulltext: 'FULLTEXT index',
};

function runLabel(run: string): string {
  return RUN_LABELS[run] ?? run;
}

/** A failed measurement, in words: the MySQL errors the probes meet. */
export function missingReason(failure: string): string {
  if (failure.includes('1191')) {
    return 'needs a FULLTEXT index';
  }
  if (failure.includes('ERROR 188')) {
    return 'failed: FTS result cache limit (error 188)';
  }
  return `failed: ${failure}`;
}

/** The SQL predicates in words: what the quicksearch (or an alternative) would ask MySQL. */
const PREDICATE_LABELS: Record<string, string> = {
  titleContains: 'title contains',
  titleBeginsWith: 'title starts with',
  shortDescContains: 'short description contains',
  titleMatch: 'title MATCH (FULLTEXT)',
};

function missing(row: CsvRow): Bar {
  return { series: runLabel(row.run), value: null, note: missingReason(row.failure) };
}

/** Groups rows by label in first-seen order; one bar per run, in the runs' fixed order. */
function grouped(
  rows: CsvRow[],
  runs: string[],
  label: (row: CsvRow) => string,
  bar: (row: CsvRow) => Bar,
): BarGroup[] {
  const groups = new Map<string, CsvRow[]>();
  rows.forEach((row) => groups.set(label(row), [...(groups.get(label(row)) ?? []), row]));
  return [...groups].map(([name, members]) => ({
    label: name,
    bars: runs.flatMap((run) => members.filter((row) => row.run === run).map(bar)),
  }));
}

export function graphqlChart(rows: CsvRow[], runs: string[]): ChartSpec {
  const label = (row: CsvRow) =>
    scenarioLabel(
      row.scenario,
      row.term,
      Number(row.limit) === SUGGESTION_LIMIT ? null : Number(row.offset) / PAGE_SIZE,
    );
  const bar = (row: CsvRow): Bar =>
    row.failure
      ? missing(row)
      : { series: runLabel(row.run), value: Number(row.p50_ms), whisker: Number(row.p95_ms) };
  return {
    title: 'Quicksearch over GraphQL on 5 M articles — response time',
    unit: 'ms',
    axisLabel: 'milliseconds',
    note: 'bar = median (p50), line = p95 · warm requests, one shopper',
    series: runs.map(runLabel),
    groups: grouped(rows, runs, label, bar),
  };
}

export function probeChart(
  rows: CsvRow[],
  runs: string[],
  metric: 'warm_ms' | 'rows_examined',
): ChartSpec {
  const bar = (row: CsvRow): Bar =>
    row.failure ? missing(row) : { series: runLabel(row.run), value: Number(row[metric]) };
  const byTime = metric === 'warm_ms';
  return {
    title: byTime
      ? 'The quicksearch SQL with each predicate — time inside MySQL'
      : 'The quicksearch SQL with each predicate — rows examined',
    unit: byTime ? 'ms' : 'rows',
    axisLabel: byTime ? 'milliseconds' : 'rows examined',
    note: byTime ? 'warm, median of repeats' : 'how many rows MySQL read to answer',
    series: runs.map(runLabel),
    groups: grouped(
      rows,
      runs,
      (row) => `${PREDICATE_LABELS[row.predicate] ?? row.predicate} “${row.term}”`,
      bar,
    ),
  };
}

export function indexCostTable(rows: CsvRow[]): string {
  const seconds = (ms: number) =>
    String(ms >= 100_000 ? Math.round(ms / 1000) : Math.round(ms / 100) / 10);
  return [
    '| Index | Build time | Size on disk |',
    '| ----- | ---------: | -----------: |',
    ...rows.map(
      (row) =>
        `| ${row.kind} | ${seconds(Number(row.build_ms))} s | ${Math.round(Number(row.size_bytes) / 1024 ** 2)} MiB |`,
    ),
  ].join('\n');
}

function cell(bar: Bar | undefined): string {
  if (bar === undefined) {
    return '–';
  }
  if (bar.value === null) {
    return bar.note ? `n/a (${bar.note})` : 'n/a';
  }
  return bar.whisker === undefined
    ? formatValue(bar.value)
    : `${formatValue(bar.value)} (p95 ${formatValue(bar.whisker)})`;
}

/** The table view of a chart: the exact numbers behind every bar. */
export function comparisonTable(chart: ChartSpec): string {
  return [
    `| Scenario | ${chart.series.join(' | ')} |`,
    `| -------- | ${chart.series.map((run) => `${'-'.repeat(run.length - 1)}:`).join(' | ')} |`,
    ...chart.groups.map(
      (group) =>
        `| ${group.label} | ${chart.series.map((run) => cell(group.bars.find((bar) => bar.series === run))).join(' | ')} |`,
    ),
  ].join('\n');
}
