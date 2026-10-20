/**
 * Sprint 17, S4: the SQL behind one quicksearch request, timed inside MySQL. The statement is the one
 * graphql-storefront sent for `products(filter: { title: { contains } })` (captured from
 * performance_schema on 2026-10-20) with only the title predicate swapped, so each index can be
 * judged for contains, beginsWith, the short description and FULLTEXT on the very same query.
 */
const VIEW = 'oxv_oxarticles_1_de';
const MARKER = '/* sprint17-probe */';

const ACTIVE_SNIPPET =
  `(( ${VIEW}.oxactive = 1 and ${VIEW}.oxhidden = 0 ` +
  `and ( ${VIEW}.oxstockflag != 2 or ( ${VIEW}.oxstock + ${VIEW}.oxvarstock ) > 0 ) ` +
  `and IF( ${VIEW}.oxvarcount = 0, 1, ( select 1 from ${VIEW} as art where art.oxparentid=${VIEW}.oxid ` +
  `and art.oxactive = 1 and ( art.oxstockflag != 2 or art.oxstock > 0 ) limit 1 ) ) ))`;

function quoted(text: string): string {
  return `'${text.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

export const PREDICATES = {
  titleContains: (term: string) => `${VIEW}.OXTITLE LIKE ${quoted(`%${term}%`)}`,
  titleBeginsWith: (term: string) => `${VIEW}.OXTITLE LIKE ${quoted(`${term}%`)}`,
  shortDescContains: (term: string) => `${VIEW}.OXSHORTDESC LIKE ${quoted(`%${term}%`)}`,
  /** A phrase: the closest FULLTEXT counterpart of `contains`. */
  titleMatch: (term: string) =>
    `MATCH (${VIEW}.OXTITLE) AGAINST (${quoted(`"${term}"`)} IN BOOLEAN MODE)`,
} as const;

export type PredicateName = keyof typeof PREDICATES;

export function probeStatement(predicate: (term: string) => string, term: string): string {
  return (
    `${MARKER} SELECT ${VIEW}.OXID FROM ${VIEW} WHERE ${ACTIVE_SNIPPET} ` +
    `AND (${predicate(term)}) AND (${VIEW}.OXPARENTID = '') ORDER BY ${VIEW}.oxsort ASC LIMIT 5`
  );
}

export function explainStatement(sql: string): string {
  return `EXPLAIN ${sql}`;
}

/** Appended to a probe in the same session: the probe's own time and rows examined. */
export const STATS_STATEMENT =
  'SELECT TIMER_WAIT, ROWS_EXAMINED FROM performance_schema.events_statements_history ' +
  `WHERE THREAD_ID = PS_CURRENT_THREAD_ID() AND SQL_TEXT LIKE '${MARKER}%' ORDER BY EVENT_ID DESC LIMIT 1`;

export function parseStats(output: string): { ms: number; rowsExamined: number } {
  const lines = output.trim().split('\n');
  const [picoseconds, rows] = lines[lines.length - 1].split('\t');
  return { ms: Number(picoseconds) / 1e9, rowsExamined: Number(rows) };
}

/** EXPLAIN rows (tab-separated, no header) as `table:access:key`. */
export function parseExplain(output: string): string {
  return output
    .trim()
    .split('\n')
    .map((line) => {
      const columns = line.split('\t');
      const key = columns[6] === 'NULL' ? '-' : columns[6];
      return `${columns[2]}:${columns[4]}:${key}`;
    })
    .join(' | ');
}

export interface ProbeResult {
  coldMs: number;
  warmMs: number;
  rowsExamined: number;
  plan: string;
  failure: string | null;
}

export const PROBE_CSV_HEADER = 'run,predicate,term,cold_ms,warm_ms,rows_examined,plan,failure';

function csvText(text: string): string {
  return `"${text.replace(/"/g, '""')}"`;
}

export function toProbeCsvRow(
  run: string,
  predicate: PredicateName,
  term: string,
  result: ProbeResult,
): string {
  return [
    run,
    predicate,
    csvText(term),
    Math.round(result.coldMs * 10) / 10,
    Math.round(result.warmMs * 10) / 10,
    result.rowsExamined,
    csvText(result.plan),
    result.failure ? csvText(result.failure) : '',
  ].join(',');
}
