import { parseInstanceConfig as parseBrowserConfig } from '../../../src/config/load';
import type { InstanceConfig } from '../../../src/config/schema';
import { renderPublicConfig } from '../../../scripts/public-config.mjs';

/**
 * An `oxid-config.yaml` text as the browser would receive it: rendered through the server-side
 * allow-list (so the secret guard runs too), then validated by the app's own loader.
 */
export function parseInstanceConfig(yaml: string): InstanceConfig {
  return parseBrowserConfig(JSON.parse(renderPublicConfig(yaml)));
}
