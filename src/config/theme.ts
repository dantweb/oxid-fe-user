import type { InstanceConfig } from './schema';

/**
 * Which theme an instance runs: its explicit `theme.active`, else the default theme a plugin
 * brings along (a layout plugin's own look), else the instance's `theme.default`.
 */
export function resolveActiveTheme(
  theme: InstanceConfig['theme'],
  pluginDefaultTheme: string | null,
): string {
  return theme.active ?? pluginDefaultTheme ?? theme.default;
}
