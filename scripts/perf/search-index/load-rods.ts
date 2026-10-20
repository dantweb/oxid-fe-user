/**
 * Sprint 17, S3: loads the chunk files of generate-tsv.ts into example_perf and maps them to shop 1.
 *   npx jiti scripts/perf/search-index/load-rods.ts --tsv-dir <dir> [--log <file>]
 * Re-running first removes the previous ROD- articles, so the result is always exactly one sample.
 */
import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import {
  BULK_LOAD_SETTINGS,
  type GlobalSettings,
  analyzeStatement,
  loadStatement,
  mapToShopStatement,
  resetStatements,
  sameTableDefinition,
  secondaryIndexStatements,
  sessionPrelude,
  setGlobalStatement,
  statisticsQuery,
} from './loadSql';
import { copyIntoMysql, runSql, timed } from './mysql';
import { PERF_DATABASE } from './perfDatabase';
import { isInAppendOrder } from './rodCatalogue';

const CONTAINER_DIR = '/var/lib/mysql-files/rods';

const { values } = parseArgs({
  options: { 'tsv-dir': { type: 'string' }, log: { type: 'string' } },
});
const tsvDir = values['tsv-dir'];
if (!tsvDir) {
  throw new Error('--tsv-dir <dir> is required');
}

function step(label: string, sql: string): void {
  const { ms } = timed(() => runSql(`${sessionPrelude()}; ${sql}`));
  const line = `${new Date().toISOString()}\t${label}\t${ms} ms`;
  console.log(line);
  if (values.log) {
    appendFileSync(values.log, `${line}\n`);
  }
}

function currentSettings(): GlobalSettings {
  const names = Object.keys(BULK_LOAD_SETTINGS);
  const row = runSql(`SELECT ${names.map((name) => `@@GLOBAL.${name}`).join(', ')}`)
    .trim()
    .split('\t');
  return Object.fromEntries(names.map((name, i) => [name, Number(row[i])]));
}

/** A buffer pool resize is asynchronous, and a second one is ignored (warning only) while one runs. */
function applySettings(label: string, settings: GlobalSettings): void {
  step(label, setGlobalStatement(settings));
  for (let attempt = 0; attempt < 120; attempt++) {
    const now = currentSettings();
    if (Object.entries(settings).every(([name, value]) => now[name] === value)) {
      return;
    }
    execFileSync('sleep', ['1']);
  }
  throw new Error(`MySQL did not reach ${JSON.stringify(settings)}`);
}

function tableDefinition(database: string): string {
  return runSql(`SHOW CREATE TABLE ${database}.oxarticles`).split('\t')[1];
}

/** The loader drops and re-adds the shop's indexes: it only starts from the shop's own table definition. */
const definition = tableDefinition('example');
if (!sameTableDefinition(definition, tableDefinition(PERF_DATABASE))) {
  throw new Error(
    `${PERF_DATABASE}.oxarticles differs from the shop's: re-clone it (db-clone.sh) first`,
  );
}

const files = readdirSync(tsvDir)
  .filter((file) => file.endsWith('.tsv'))
  .sort();
/** Out-of-order rows turn the load from appends into random page splits (~50× slower): refuse them. */
const lastOxids: string[] = [];
for (const file of files) {
  const oxids = readFileSync(join(tsvDir, file), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => line.slice(0, 32));
  if (!isInAppendOrder([...lastOxids, ...oxids])) {
    throw new Error(
      `${file} is not in primary-key order: regenerate the chunks with generate-tsv.ts`,
    );
  }
  lastOxids.splice(0, 1, oxids[oxids.length - 1]);
}
copyIntoMysql(tsvDir, CONTAINER_DIR);
const original = currentSettings();
applySettings(`bulk settings (were ${JSON.stringify(original)})`, BULK_LOAD_SETTINGS);
try {
  const [unmap, remove] = resetStatements();
  step('reset: unmap ROD- articles', unmap);
  step('reset: delete ROD- articles', remove);
  const indexes = secondaryIndexStatements(runSql(statisticsQuery()), 'OXMAPID');
  step('drop secondary indexes', indexes.drop);
  for (const file of files) {
    step(`load ${file}`, loadStatement(`${CONTAINER_DIR}/${file}`));
  }
  step('re-add secondary indexes', indexes.add);
  step('map ROD- articles to shop 1', mapToShopStatement());
  step('analyze', analyzeStatement());
} finally {
  applySettings('restore settings', original);
}
if (!sameTableDefinition(definition, tableDefinition(PERF_DATABASE))) {
  throw new Error(`${PERF_DATABASE}.oxarticles no longer matches the shop's table definition`);
}

const size = runSql(
  `SELECT TABLE_ROWS, DATA_LENGTH, INDEX_LENGTH FROM information_schema.TABLES
   WHERE TABLE_SCHEMA = '${PERF_DATABASE}' AND TABLE_NAME = 'oxarticles'`,
).trim();
const rods = runSql(
  `SELECT COUNT(*) FROM ${PERF_DATABASE}.oxarticles WHERE OXARTNUM LIKE 'ROD-%'`,
).trim();
const summary = `rods=${rods}\toxarticles rows~/data bytes/index bytes=${size.replace(/\t/g, '/')}`;
console.log(summary);
if (values.log) {
  appendFileSync(values.log, `${summary}\n`);
}
