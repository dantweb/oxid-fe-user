import type { IPlugin } from '@dantweb/oxid-fe-core';
import type { InstanceConfig } from './schema';

type PluginImporter = (path: string) => Promise<{ default: IPlugin }>;

interface LoadedPlugin {
  plugin: IPlugin;
  config: Record<string, unknown>;
}

/**
 * Resolves the instance's plugin set: `enabled` entries only, bundled plugins from the compiled
 * map, external ones from `/plugins/<name>/index.js` (the instance's plugins folder).
 * An enabled bundled plugin the build does not contain is a configuration error.
 */
export async function loadConfiguredPlugins(
  config: InstanceConfig,
  bundled: Record<string, () => Promise<{ default: IPlugin }>>,
  importExternal: PluginImporter,
): Promise<LoadedPlugin[]> {
  const loaded: LoadedPlugin[] = [];
  for (const [name, entry] of Object.entries(config.plugins)) {
    if (!entry.enabled) {
      continue;
    }
    if (entry.source === 'external') {
      const module = await importExternal(`/plugins/${name}/index.js`);
      loaded.push({ plugin: module.default, config: entry.config });
      continue;
    }
    const loader = bundled[name];
    if (!loader) {
      throw new Error(
        `oxid-config.yaml enables bundled plugin "${name}", but this build does not contain it`,
      );
    }
    loaded.push({ plugin: (await loader()).default, config: entry.config });
  }
  return loaded;
}
