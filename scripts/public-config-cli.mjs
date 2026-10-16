/**
 * node scripts/public-config-cli.mjs <oxid-config.yaml> <oxid-config.json>
 * Renders the browser's public config (see public-config.mjs). Exit 1 when it would expose a secret.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { renderPublicConfig } from './public-config.mjs';

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error('usage: public-config-cli.mjs <oxid-config.yaml> <oxid-config.json>');
  process.exit(2);
}
try {
  writeFileSync(output, renderPublicConfig(readFileSync(input, 'utf-8')));
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
