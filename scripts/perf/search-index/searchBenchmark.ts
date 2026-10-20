import { PAGE_SIZE, SUGGESTION_LIMIT, normalizeTerm } from '../../../plugins/shop/search/searchApi';
import { SEARCH_QUERY } from '../../../plugins/shop/search/searchQuery';

/**
 * Sprint 17, S4: times the GraphQL request the quicksearch sends. Query document, limits and term
 * normalization are the storefront's own, so the benchmark cannot drift from what shoppers send.
 */
export interface Scenario {
  name: string;
  term: string;
  /** null: the suggestion dropdown; a number: that results page. */
  page: number | null;
}

export interface SearchRequest {
  query: string;
  variables: { q: string; limit: number; offset: number };
}

export type Transport = (body: SearchRequest) => Promise<{ status: number; json: unknown }>;

export interface MeasureOptions {
  transport: Transport;
  clock: () => number;
  warmups: number;
  samples: number;
  /** Stop before a sample that would overrun this (full scans of 5 M rows take seconds each). */
  budgetMs?: number;
  minSamples?: number;
}

export interface ScenarioResult {
  scenario: Scenario;
  request: SearchRequest;
  coldMs: number;
  samplesMs: number[];
  rowsReturned: number;
  failure: string | null;
}

export function buildRequest(scenario: Scenario): SearchRequest {
  const q = normalizeTerm(scenario.term);
  if (scenario.page === null) {
    return { query: SEARCH_QUERY, variables: { q, limit: SUGGESTION_LIMIT, offset: 0 } };
  }
  return {
    query: SEARCH_QUERY,
    variables: { q, limit: PAGE_SIZE + 1, offset: scenario.page * PAGE_SIZE },
  };
}

/** Linear interpolation between closest ranks (numpy's default). */
export function percentile(samples: number[], p: number): number {
  const sorted = [...samples].sort((a, b) => a - b);
  const rank = ((sorted.length - 1) * p) / 100;
  const lower = Math.floor(rank);
  const upper = Math.ceil(rank);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (rank - lower);
}

interface Answer {
  ms: number;
  rows: number;
  failure: string | null;
}

async function send(request: SearchRequest, options: MeasureOptions): Promise<Answer> {
  const start = options.clock();
  const { status, json } = await options.transport(request);
  const ms = options.clock() - start;
  if (status !== 200) {
    return { ms, rows: 0, failure: `HTTP ${status}` };
  }
  const body = json as { data?: { products?: unknown[] }; errors?: Array<{ message: string }> };
  if (body.errors?.length) {
    return { ms, rows: 0, failure: body.errors[0].message };
  }
  return { ms, rows: body.data?.products?.length ?? 0, failure: null };
}

function wantsAnotherSample(samplesMs: number[], options: MeasureOptions): boolean {
  if (samplesMs.length >= options.samples) {
    return false;
  }
  if (samplesMs.length < (options.minSamples ?? 1) || options.budgetMs === undefined) {
    return true;
  }
  const spent = samplesMs.reduce((sum, ms) => sum + ms, 0);
  return spent + samplesMs[samplesMs.length - 1] <= options.budgetMs;
}

/** The first request is the cold one and counts as a warm-up; only requests after the warm-up are sampled. */
export async function measureScenario(
  scenario: Scenario,
  options: MeasureOptions,
): Promise<ScenarioResult> {
  const request = buildRequest(scenario);
  const result: ScenarioResult = {
    scenario,
    request,
    coldMs: 0,
    samplesMs: [],
    rowsReturned: 0,
    failure: null,
  };
  for (let i = 0; i < options.warmups; i++) {
    const answer = await send(request, options);
    if (answer.failure) {
      return { ...result, failure: answer.failure };
    }
    result.coldMs ||= answer.ms;
    result.rowsReturned = answer.rows;
  }
  while (wantsAnotherSample(result.samplesMs, options)) {
    const answer = await send(request, options);
    if (answer.failure) {
      return { ...result, samplesMs: [], failure: answer.failure };
    }
    result.samplesMs.push(answer.ms);
  }
  return result;
}

export const CSV_HEADER =
  'run,scenario,term,limit,offset,n,cold_ms,p50_ms,p95_ms,p99_ms,min_ms,max_ms,rows_returned,failure';

function rounded(ms: number): number {
  return Math.round(ms * 10) / 10;
}

export function toCsvRow(run: string, result: ScenarioResult): string {
  const samples = result.samplesMs;
  const stats = samples.length
    ? [50, 95, 99, 0, 100].map((p) => rounded(percentile(samples, p)))
    : ['', '', '', '', ''];
  const { q, limit, offset } = result.request.variables;
  return [
    run,
    result.scenario.name,
    `"${q.replace(/"/g, '""')}"`,
    limit,
    offset,
    samples.length,
    rounded(result.coldMs),
    ...stats,
    result.rowsReturned,
    result.failure ? `"${result.failure.replace(/"/g, '""')}"` : '',
  ].join(',');
}
