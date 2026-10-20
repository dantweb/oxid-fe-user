/**
 * Sprint 17, S5: adds or drops the indexes under test and records their build time and size.
 *   npx jiti scripts/perf/search-index/migrate.ts up|down btree|fulltext [--csv <raw>/indexes.csv]
 */
import { appendFileSync, existsSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { INDEX_KINDS, indexDown, indexSizeQuery, indexUp, type IndexKind } from './indexMigrations';
import { runSql, timed } from './mysql';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { csv: { type: 'string' } },
});
const [direction, kind] = positionals as ['up' | 'down', IndexKind];
if (!['up', 'down'].includes(direction) || !INDEX_KINDS.includes(kind)) {
  throw new Error('usage: migrate.ts up|down btree|fulltext');
}

const statements = direction === 'up' ? indexUp(kind) : indexDown(kind);
const { ms } = timed(() => runSql(`${statements.join('; ')};`));
console.log(`${direction} ${kind}: ${ms} ms`);

if (direction === 'up' && values.csv) {
  runSql('ANALYZE TABLE oxarticles');
  const bytes = Number(runSql(indexSizeQuery(kind)).trim());
  if (!existsSync(values.csv)) {
    appendFileSync(values.csv, 'kind,build_ms,size_bytes\n');
  }
  appendFileSync(values.csv, `${kind},${ms},${bytes}\n`);
  console.log(`${kind} size: ${(bytes / 1024 ** 2).toFixed(0)} MiB`);
}
