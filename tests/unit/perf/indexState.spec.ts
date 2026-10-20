// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  expectedIndexes,
  indexStateQuery,
} from '../../../scripts/perf/search-index/indexMigrations';
import { runSql } from '../../../scripts/perf/search-index/mysql';

/** Set PERF_INDEXES to the run being measured (none | btree | fulltext): the schema must match it. */
const run = process.env.PERF_INDEXES ?? '';

describe.runIf(run)('perf indexes match the run being measured', () => {
  it(`example_perf.oxarticles has exactly the "${run}" indexes`, () => {
    const actual = runSql(indexStateQuery())
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => line.split('\t'))
      .map(([name, column, type]) => ({ name, column, type }));
    const expected = run === 'none' ? [] : expectedIndexes(run as 'btree' | 'fulltext');
    expect(actual).toEqual(expect.arrayContaining(expected));
    expect(actual).toHaveLength(expected.length);
  });
});
