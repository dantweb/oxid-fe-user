// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  CSV_HEADER,
  buildRequest,
  measureScenario,
  percentile,
  toCsvRow,
  type Scenario,
  type Transport,
} from '../../../scripts/perf/search-index/searchBenchmark';
import { SEARCH_QUERY } from '../../../plugins/shop/search/searchQuery';
import { MAX_PAGES, PAGE_SIZE, SUGGESTION_LIMIT } from '../../../plugins/shop/search/searchApi';

const suggest: Scenario = { name: 'suggest-shape', term: 'U-shape AlTi', page: null };

/** A clock that advances by the given step every time a request is sent. */
function fakeClock(stepsMs: number[]): {
  clock: () => number;
  transport: Transport;
  sent: unknown[];
} {
  let now = 0;
  let call = 0;
  const sent: unknown[] = [];
  return {
    clock: () => now,
    sent,
    transport: async (body) => {
      sent.push(body);
      now += stepsMs[Math.min(call, stepsMs.length - 1)];
      call += 1;
      return { status: 200, json: { data: { products: [{ id: 'a' }, { id: 'b' }] } } };
    },
  };
}

describe('quicksearch request', () => {
  it('sends SEARCH_QUERY with the suggestion variables', () => {
    expect(buildRequest(suggest)).toEqual({
      query: SEARCH_QUERY,
      variables: { q: 'U-shape AlTi', limit: SUGGESTION_LIMIT, offset: 0 },
    });
  });

  it('asks a results page as PAGE_SIZE + 1 at offset page × PAGE_SIZE', () => {
    const last = { name: 'page-last', term: 'L-shape', page: MAX_PAGES - 1 };
    expect(buildRequest(last).variables).toEqual({
      q: 'L-shape',
      limit: PAGE_SIZE + 1,
      offset: (MAX_PAGES - 1) * PAGE_SIZE,
    });
  });

  it('normalizes the term the way the storefront does', () => {
    expect(buildRequest({ ...suggest, term: '  %metal   rod% ' }).variables.q).toBe('metal rod');
  });
});

describe('percentile', () => {
  it.each([
    [[5], 50, 5],
    [[1, 2, 3], 50, 2],
    [[1, 2, 3, 4], 50, 2.5],
    [[10, 20, 30, 40, 50], 95, 48],
    [[4, 1, 3, 2], 100, 4],
    [[4, 1, 3, 2], 0, 1],
  ])('of %j at p%i is %d (linear interpolation, unsorted input)', (samples, p, expected) => {
    expect(percentile(samples, p)).toBeCloseTo(expected);
  });
});

describe('measuring a scenario', () => {
  it('reports the first request as cold and times only the requests after the warm-up', async () => {
    const { clock, transport, sent } = fakeClock([900, 50, 50, 10, 20, 30]);
    const result = await measureScenario(suggest, { transport, clock, warmups: 3, samples: 3 });

    expect(sent).toHaveLength(6);
    expect(result.coldMs).toBe(900);
    expect(result.samplesMs).toEqual([10, 20, 30]);
    expect(result.rowsReturned).toBe(2);
    expect(result.failure).toBeNull();
  });

  it('stops sampling when the time budget is spent, but keeps the minimum', async () => {
    const { clock, transport } = fakeClock([100, 100, 100, 1000]);
    const result = await measureScenario(suggest, {
      transport,
      clock,
      warmups: 1,
      samples: 30,
      budgetMs: 2500,
      minSamples: 3,
    });
    expect(result.samplesMs).toEqual([100, 100, 1000, 1000]);
  });

  it('marks a GraphQL error as a failure instead of timing it', async () => {
    const transport: Transport = async () => ({
      status: 200,
      json: { errors: [{ message: 'boom' }] },
    });
    const result = await measureScenario(suggest, {
      transport,
      clock: () => 0,
      warmups: 1,
      samples: 3,
    });
    expect(result.failure).toBe('boom');
    expect(result.samplesMs).toEqual([]);
  });

  it('marks a non-200 answer as a failure', async () => {
    const transport: Transport = async () => ({ status: 502, json: null });
    const result = await measureScenario(suggest, {
      transport,
      clock: () => 0,
      warmups: 1,
      samples: 3,
    });
    expect(result.failure).toBe('HTTP 502');
  });
});

describe('CSV', () => {
  it('has one column per reported value', () => {
    expect(CSV_HEADER).toBe(
      'run,scenario,term,limit,offset,n,cold_ms,p50_ms,p95_ms,p99_ms,min_ms,max_ms,rows_returned,failure',
    );
  });

  it('writes a result row with quoted term and rounded timings', async () => {
    const { clock, transport } = fakeClock([900, 10, 20, 30]);
    const result = await measureScenario(suggest, { transport, clock, warmups: 1, samples: 3 });
    expect(toCsvRow('btree', result)).toBe(
      'btree,suggest-shape,"U-shape AlTi",5,0,3,900,20,29,29.8,10,30,2,',
    );
  });
});
