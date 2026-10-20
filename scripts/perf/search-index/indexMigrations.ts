import { PERF_DATABASE } from './perfDatabase';

/** Sprint 17, S5: the indexes under test, added and removed on the perf database only. */
export const INDEX_KINDS = ['btree', 'fulltext'] as const;
export type IndexKind = (typeof INDEX_KINDS)[number];

interface IndexSpec {
  name: string;
  column: 'OXTITLE' | 'OXSHORTDESC';
  type: 'BTREE' | 'FULLTEXT';
}

const ARTICLES = `${PERF_DATABASE}.oxarticles`;
/** The shop's columns default to zero dates, which strict mode rejects in any ALTER of the table. */
const RELAXED_MODE = "SET SESSION sql_mode = ''";

const INDEXES: Record<IndexKind, IndexSpec[]> = {
  btree: [
    { name: 'OXTITLE_PERF', column: 'OXTITLE', type: 'BTREE' },
    { name: 'OXSHORTDESC_PERF', column: 'OXSHORTDESC', type: 'BTREE' },
  ],
  fulltext: [
    { name: 'OXTITLE_FT', column: 'OXTITLE', type: 'FULLTEXT' },
    { name: 'OXSHORTDESC_FT', column: 'OXSHORTDESC', type: 'FULLTEXT' },
  ],
};

export function expectedIndexes(kind: IndexKind): IndexSpec[] {
  return INDEXES[kind];
}

/** Statements for one session: the relaxed mode first. */
export function indexUp(kind: IndexKind): string[] {
  if (kind === 'fulltext') {
    return [
      RELAXED_MODE,
      ...INDEXES.fulltext.map(
        (index) => `ALTER TABLE ${ARTICLES} ADD FULLTEXT INDEX ${index.name} (${index.column})`,
      ),
    ];
  }
  const added = INDEXES.btree.map((index) => `ADD INDEX ${index.name} (${index.column})`);
  return [
    RELAXED_MODE,
    `ALTER TABLE ${ARTICLES} ${added.join(', ')}, ALGORITHM=INPLACE, LOCK=NONE`,
  ];
}

export function indexDown(kind: IndexKind): string[] {
  const dropped = INDEXES[kind].map((index) => `DROP INDEX ${index.name}`);
  return [RELAXED_MODE, `ALTER TABLE ${ARTICLES} ${dropped.join(', ')}`];
}

export function indexStateQuery(): string {
  const names = INDEX_KINDS.flatMap((kind) => INDEXES[kind].map((index) => `'${index.name}'`));
  return (
    'SELECT DISTINCT INDEX_NAME, COLUMN_NAME, INDEX_TYPE FROM information_schema.STATISTICS ' +
    `WHERE TABLE_SCHEMA = '${PERF_DATABASE}' AND TABLE_NAME = 'oxarticles' AND INDEX_NAME IN (${names.join(', ')})`
  );
}

/** Bytes on disk. A FULLTEXT index lives in its own fts_* tablespaces, not in innodb_index_stats. */
export function indexSizeQuery(kind: IndexKind): string {
  if (kind === 'fulltext') {
    return `SELECT SUM(FILE_SIZE) FROM information_schema.INNODB_TABLESPACES WHERE NAME LIKE '${PERF_DATABASE}/fts\\_%'`;
  }
  const names = INDEXES.btree.map((index) => `'${index.name}'`).join(', ');
  return (
    'SELECT SUM(stat_value) * @@innodb_page_size FROM mysql.innodb_index_stats ' +
    `WHERE database_name = '${PERF_DATABASE}' AND table_name = 'oxarticles' AND stat_name = 'size' ` +
    `AND index_name IN (${names})`
  );
}
