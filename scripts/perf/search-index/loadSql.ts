import { PERF_DATABASE } from './perfDatabase';
import { ARTICLE_COLUMNS } from './rodCatalogue';

/** Sprint 17, S3: the statements that put the rod sample into the perf database. Pure strings. */
const ROD_ARTICLES = "OXARTNUM LIKE 'ROD-%'";
const ARTICLES = `${PERF_DATABASE}.oxarticles`;
const ARTICLES_TO_SHOP = `${PERF_DATABASE}.oxarticles2shop`;

/**
 * The shop's own rows carry zero dates; strict mode would reject the defaults LOAD DATA fills in.
 * Generated rows are reproducible from the seed, so they stay out of the binary log.
 */
export function sessionPrelude(): string {
  return [
    "SET SESSION sql_mode = ''",
    'SET SESSION sql_log_bin = 0',
    'SET SESSION unique_checks = 0',
    'SET SESSION foreign_key_checks = 0',
  ].join('; ');
}

export type GlobalSettings = Record<string, number>;

/**
 * The SDK's MySQL defaults (100 MB redo log, IO capacity 200, 128 MB buffer pool) make a 5 M row
 * load take hours. All three are dynamic: raised for the load, restored before anything is measured.
 */
export const BULK_LOAD_SETTINGS: GlobalSettings = {
  innodb_redo_log_capacity: 2 * 1024 ** 3,
  innodb_io_capacity: 2000,
  innodb_buffer_pool_size: 1024 ** 3,
};

export function setGlobalStatement(settings: GlobalSettings): string {
  return Object.entries(settings)
    .map(([name, value]) => `SET GLOBAL ${name} = ${value}`)
    .join('; ');
}

/** Mapping rows first: they are found through the articles about to be deleted. */
export function resetStatements(): [string, string] {
  return [
    `DELETE t2s FROM ${ARTICLES_TO_SHOP} t2s JOIN ${ARTICLES} a ON a.OXMAPID = t2s.OXMAPOBJECTID WHERE a.${ROD_ARTICLES}`,
    `DELETE FROM ${ARTICLES} WHERE ${ROD_ARTICLES}`,
  ];
}

export function loadStatement(file: string): string {
  return `LOAD DATA INFILE '${file}' INTO TABLE ${ARTICLES} (${ARTICLE_COLUMNS.join(', ')})`;
}

/** The shop views (`oxv_oxarticles_1_*`) join oxarticles2shop on OXMAPID: unmapped articles are invisible. */
export function mapToShopStatement(): string {
  return `INSERT INTO ${ARTICLES_TO_SHOP} (OXSHOPID, OXMAPOBJECTID) SELECT 1, OXMAPID FROM ${ARTICLES} WHERE ${ROD_ARTICLES}`;
}

export function analyzeStatement(): string {
  return `ANALYZE TABLE ${ARTICLES}, ${ARTICLES_TO_SHOP}`;
}

/**
 * Inserting 5 M rows while 16 secondary indexes are maintained runs at ~1 000 rows/s once the table
 * outgrows the buffer pool; without them it appends at ~11 000 rows/s, and InnoDB then builds each
 * index by sorting. The indexes are dropped and re-added from their own SHOW INDEX rows, in the
 * data-dictionary order, so SHOW CREATE TABLE comes out identical.
 */
export function statisticsQuery(): string {
  return `SHOW INDEX FROM ${ARTICLES}`;
}

interface IndexColumns {
  unique: boolean;
  fulltext: boolean;
  columns: Array<{ seq: number; sql: string }>;
}

function groupIndexes(statistics: string, autoIncrementColumn: string): Map<string, IndexColumns> {
  const indexes = new Map<string, IndexColumns>();
  for (const line of statistics.trim().split('\n')) {
    const [, nonUnique, name, seq, column, , , subPart, , , type] = line.split('\t');
    if (name === 'PRIMARY' || (seq === '1' && column === autoIncrementColumn)) {
      continue;
    }
    const index = indexes.get(name) ?? {
      unique: nonUnique === '0',
      fulltext: type === 'FULLTEXT',
      columns: [],
    };
    const prefix = subPart === 'NULL' ? '' : `(${subPart})`;
    index.columns.push({ seq: Number(seq), sql: `\`${column}\`${prefix}` });
    indexes.set(name, index);
  }
  return indexes;
}

function addClause(name: string, index: IndexColumns): string {
  const kind = index.fulltext ? 'FULLTEXT INDEX' : index.unique ? 'UNIQUE INDEX' : 'INDEX';
  const columns = [...index.columns].sort((a, b) => a.seq - b.seq).map((column) => column.sql);
  return `ADD ${kind} \`${name}\` (${columns.join(', ')})`;
}

/** An index led by the AUTO_INCREMENT column stays: MySQL refuses to drop it (and it is appended in order anyway). */
export function secondaryIndexStatements(
  statistics: string,
  autoIncrementColumn = '',
): { drop: string; add: string } {
  const indexes = [...groupIndexes(statistics, autoIncrementColumn)];
  return {
    drop: `ALTER TABLE ${ARTICLES} ${indexes.map(([name]) => `DROP INDEX \`${name}\``).join(', ')}`,
    add: `ALTER TABLE ${ARTICLES} ${indexes.map(([name, index]) => addClause(name, index)).join(', ')}`,
  };
}

/**
 * Same columns and indexes. Ignored: the AUTO_INCREMENT counter, and the order of KEY lines (the
 * index on the AUTO_INCREMENT column is kept during the load, so it is listed before the re-added ones).
 * `mysql -B` prints the definition with escaped newlines.
 */
export function sameTableDefinition(before: string, after: string): boolean {
  const lines = (definition: string) =>
    definition
      .replace(/ AUTO_INCREMENT=\d+/, '')
      .split('\\n')
      .map((line) => line.replace(/,$/, ''))
      .sort()
      .join('\n');
  return lines(before) === lines(after);
}
