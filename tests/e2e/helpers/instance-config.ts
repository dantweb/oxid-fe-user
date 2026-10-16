import { existsSync, readFileSync } from 'node:fs';
import { renderPublicConfig } from '../../../scripts/public-config.mjs';
import { parseInstanceConfig } from '../../unit/helpers/yamlConfig';

/**
 * The instance configuration of THE deployment under test: this repo's `oxid-config.yaml`
 * (falling back to the `.dist` where none was created). The deployed storefront serves the public
 * JSON rendered from this file (never the file itself), so expectations are derived from it instead of being hardcoded in every spec.
 */
const FILE = existsSync('oxid-config.yaml') ? 'oxid-config.yaml' : 'oxid-config.yaml.dist';

export const deployedConfigFile = FILE;
export const deployedConfigText = (): string => readFileSync(FILE, 'utf-8');
/** What the server must answer at /oxid-config.json for this deployment. */
export const expectedPublicConfig = (): unknown =>
  JSON.parse(renderPublicConfig(deployedConfigText()));
export const deployedConfig = (): ReturnType<typeof parseInstanceConfig> =>
  parseInstanceConfig(deployedConfigText());

export const shopName = (): string => deployedConfig().instance.name;

export function productsPerPage(): number {
  return Number(deployedConfig().plugins.shop?.config.products_per_page ?? 12);
}

export const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
