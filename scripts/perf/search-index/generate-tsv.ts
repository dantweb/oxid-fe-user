/**
 * Sprint 17, S2: writes the seeded rod sample as LOAD DATA chunk files.
 *   npx jiti scripts/perf/search-index/generate-tsv.ts --out <dir> [--seed 20261020] [--count 5000000] [--chunk 500000]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { inPrimaryKeyOrder, sample, toArticleRow, toTsvRow } from './rodCatalogue';

const { values } = parseArgs({
  options: {
    out: { type: 'string' },
    seed: { type: 'string', default: '20261020' },
    count: { type: 'string', default: '5000000' },
    chunk: { type: 'string', default: '500000' },
  },
});
if (!values.out) {
  throw new Error('--out <dir> is required');
}

const picked = inPrimaryKeyOrder(sample(Number(values.seed), Number(values.count)));
const chunkSize = Number(values.chunk);
mkdirSync(values.out, { recursive: true });

for (let start = 0; start < picked.length; start += chunkSize) {
  const lines = Array.from(picked.subarray(start, start + chunkSize), (index) =>
    toTsvRow(toArticleRow(index)),
  );
  const file = join(values.out, `rods-${String(start / chunkSize).padStart(2, '0')}.tsv`);
  writeFileSync(file, `${lines.join('\n')}\n`);
  console.log(`${file}: ${lines.length} rows`);
}
