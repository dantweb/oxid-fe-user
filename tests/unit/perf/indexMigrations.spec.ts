// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  INDEX_KINDS,
  expectedIndexes,
  indexStateQuery,
  indexSizeQuery,
  indexDown,
  indexUp,
} from '../../../scripts/perf/search-index/indexMigrations';

describe('index migrations', () => {
  it('knows the two measured kinds', () => {
    expect(INDEX_KINDS).toEqual(['btree', 'fulltext']);
  });

  it.each(['btree', 'fulltext'] as const)(
    "%s relaxes strict mode first: the shop's zero-date defaults make any ALTER fail",
    (kind) => {
      expect(indexUp(kind)[0]).toBe("SET SESSION sql_mode = ''");
      expect(indexDown(kind)[0]).toBe("SET SESSION sql_mode = ''");
    },
  );

  it('adds both B-tree indexes online in one statement', () => {
    expect(indexUp('btree').slice(1)).toEqual([
      'ALTER TABLE example_perf.oxarticles ADD INDEX OXTITLE_PERF (OXTITLE), ' +
        'ADD INDEX OXSHORTDESC_PERF (OXSHORTDESC), ALGORITHM=INPLACE, LOCK=NONE',
    ]);
  });

  it('adds the FULLTEXT indexes one per statement (InnoDB builds one at a time)', () => {
    expect(indexUp('fulltext').slice(1)).toEqual([
      'ALTER TABLE example_perf.oxarticles ADD FULLTEXT INDEX OXTITLE_FT (OXTITLE)',
      'ALTER TABLE example_perf.oxarticles ADD FULLTEXT INDEX OXSHORTDESC_FT (OXSHORTDESC)',
    ]);
  });

  it.each(['btree', 'fulltext'] as const)('%s down drops exactly what up added', (kind) => {
    const added = expectedIndexes(kind).map((index) => `DROP INDEX ${index.name}`);
    expect(indexDown(kind).slice(1)).toEqual([
      `ALTER TABLE example_perf.oxarticles ${added.join(', ')}`,
    ]);
  });

  it('expects one index per column, of the kind measured', () => {
    expect(expectedIndexes('btree')).toEqual([
      { name: 'OXTITLE_PERF', column: 'OXTITLE', type: 'BTREE' },
      { name: 'OXSHORTDESC_PERF', column: 'OXSHORTDESC', type: 'BTREE' },
    ]);
    expect(expectedIndexes('fulltext').map((index) => index.type)).toEqual([
      'FULLTEXT',
      'FULLTEXT',
    ]);
  });

  it('reads the state and size of the perf indexes from example_perf only', () => {
    expect(indexStateQuery()).toContain(
      "TABLE_SCHEMA = 'example_perf' AND TABLE_NAME = 'oxarticles'",
    );
    expect(indexStateQuery()).toContain(
      "IN ('OXTITLE_PERF', 'OXSHORTDESC_PERF', 'OXTITLE_FT', 'OXSHORTDESC_FT')",
    );
    expect(indexSizeQuery('btree')).toContain('mysql.innodb_index_stats');
    expect(indexSizeQuery('fulltext')).toContain("NAME LIKE 'example_perf/fts\\_%'");
  });

  it('never names the demo database', () => {
    const all = INDEX_KINDS.flatMap((kind) => [
      ...indexUp(kind),
      ...indexDown(kind),
      indexSizeQuery(kind),
    ]);
    expect(all.join('\n')).not.toMatch(/\bexample\./);
  });
});
