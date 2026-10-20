// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  BULK_LOAD_SETTINGS,
  analyzeStatement,
  loadStatement,
  mapToShopStatement,
  resetStatements,
  sameTableDefinition,
  secondaryIndexStatements,
  statisticsQuery,
  sessionPrelude,
  setGlobalStatement,
} from '../../../scripts/perf/search-index/loadSql';
import { ARTICLE_COLUMNS } from '../../../scripts/perf/search-index/rodCatalogue';

describe('load SQL', () => {
  it('loads a chunk into example_perf.oxarticles with the TSV columns in row order', () => {
    expect(loadStatement('/var/lib/mysql-files/rods/rods-03.tsv')).toBe(
      "LOAD DATA INFILE '/var/lib/mysql-files/rods/rods-03.tsv' INTO TABLE example_perf.oxarticles " +
        `(${ARTICLE_COLUMNS.join(', ')})`,
    );
  });

  it('resets only ROD- articles and their shop mapping, mapping first', () => {
    const [unmap, remove] = resetStatements();
    expect(unmap).toContain('DELETE t2s FROM example_perf.oxarticles2shop');
    expect(unmap).toContain("OXARTNUM LIKE 'ROD-%'");
    expect(remove).toBe("DELETE FROM example_perf.oxarticles WHERE OXARTNUM LIKE 'ROD-%'");
  });

  it('maps every ROD- article to shop 1, or the shop views would not show it', () => {
    expect(mapToShopStatement()).toBe(
      'INSERT INTO example_perf.oxarticles2shop (OXSHOPID, OXMAPOBJECTID) ' +
        "SELECT 1, OXMAPID FROM example_perf.oxarticles WHERE OXARTNUM LIKE 'ROD-%'",
    );
  });

  it('relaxes strict mode for the session so unlisted columns take the shop defaults', () => {
    expect(sessionPrelude()).toContain("SET SESSION sql_mode = ''");
  });

  it('keeps the 5 M row events out of the binary log, for this session only', () => {
    expect(sessionPrelude()).toContain('SET SESSION sql_log_bin = 0');
  });

  it('raises redo log, IO capacity and buffer pool for the load only', () => {
    expect(Object.keys(BULK_LOAD_SETTINGS)).toEqual([
      'innodb_redo_log_capacity',
      'innodb_io_capacity',
      'innodb_buffer_pool_size',
    ]);
    expect(
      setGlobalStatement({ innodb_io_capacity: 200, innodb_buffer_pool_size: 134217728 }),
    ).toBe('SET GLOBAL innodb_io_capacity = 200; SET GLOBAL innodb_buffer_pool_size = 134217728');
  });

  it('refreshes the optimizer statistics of both tables', () => {
    expect(analyzeStatement()).toBe(
      'ANALYZE TABLE example_perf.oxarticles, example_perf.oxarticles2shop',
    );
  });

  it('never names the demo database', () => {
    const all = [
      loadStatement('/x.tsv'),
      ...resetStatements(),
      mapToShopStatement(),
      sessionPrelude(),
      analyzeStatement(),
    ].join('\n');
    expect(all).not.toMatch(/\bexample\./);
  });
});

describe('secondary indexes around the bulk load', () => {
  /** SHOW INDEX rows: Table, Non_unique, Key_name, Seq_in_index, Column_name, Collation, Cardinality, Sub_part, Packed, Null, Index_type */
  const row = (
    name: string,
    nonUnique: number,
    seq: number,
    column: string,
    subPart = 'NULL',
    type = 'BTREE',
  ) => ['oxarticles', nonUnique, name, seq, column, 'A', 1, subPart, 'NULL', '', type].join('\t');
  const statistics = [
    row('PRIMARY', 0, 1, 'OXID'),
    row('OXMAPID', 0, 1, 'OXMAPID'),
    row('OXSORT', 1, 1, 'OXSORT'),
    row('parentsort', 1, 1, 'OXPARENTID'),
    row('parentsort', 1, 2, 'OXSORT'),
    row('OXTITLE_PREFIX', 1, 1, 'OXTITLE', '20'),
  ].join('\n');

  it('reads the indexes of example_perf.oxarticles in data-dictionary order', () => {
    expect(statisticsQuery()).toBe('SHOW INDEX FROM example_perf.oxarticles');
  });

  it('drops every index but the primary key', () => {
    expect(secondaryIndexStatements(statistics).drop).toBe(
      'ALTER TABLE example_perf.oxarticles DROP INDEX `OXMAPID`, DROP INDEX `OXSORT`, ' +
        'DROP INDEX `parentsort`, DROP INDEX `OXTITLE_PREFIX`',
    );
  });

  it('re-adds them in their original order, with column order, uniqueness and prefix lengths kept', () => {
    expect(secondaryIndexStatements(statistics).add).toBe(
      'ALTER TABLE example_perf.oxarticles ADD UNIQUE INDEX `OXMAPID` (`OXMAPID`), ' +
        'ADD INDEX `OXSORT` (`OXSORT`), ADD INDEX `parentsort` (`OXPARENTID`, `OXSORT`), ' +
        'ADD INDEX `OXTITLE_PREFIX` (`OXTITLE`(20))',
    );
  });

  it('keeps the index of the AUTO_INCREMENT column, which MySQL will not drop', () => {
    const { drop, add } = secondaryIndexStatements(statistics, 'OXMAPID');
    expect(drop).not.toContain('`OXMAPID`');
    expect(add).not.toContain('`OXMAPID`');
    expect(drop).toContain('DROP INDEX `OXSORT`');
  });

  it('re-adds a FULLTEXT index as FULLTEXT', () => {
    expect(secondaryIndexStatements(row('FT', 1, 1, 'OXTITLE', 'NULL', 'FULLTEXT')).add).toBe(
      'ALTER TABLE example_perf.oxarticles ADD FULLTEXT INDEX `FT` (`OXTITLE`)',
    );
  });

  it('compares table definitions regardless of the order of their KEY lines', () => {
    const before = 'CREATE TABLE `t` (\\n  KEY `A` (`A`),\\n  KEY `B` (`B`)\\n) ENGINE=InnoDB';
    const after = 'CREATE TABLE `t` (\\n  KEY `B` (`B`),\\n  KEY `A` (`A`)\\n) ENGINE=InnoDB';
    expect(sameTableDefinition(before, after)).toBe(true);
  });

  it('compares table definitions ignoring only the AUTO_INCREMENT counter', () => {
    const before =
      'CREATE TABLE `oxarticles` (\n  KEY `A` (`A`)\n) ENGINE=InnoDB AUTO_INCREMENT=349 DEFAULT';
    expect(sameTableDefinition(before, before.replace('349', '5000349'))).toBe(true);
    expect(sameTableDefinition(before, before.replace('KEY `A`', 'KEY `B`'))).toBe(false);
  });
});
