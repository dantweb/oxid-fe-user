import type { OverrideSlot, PluginRegistry } from '@dantweb/oxid-fe-core';
import { defineAsyncComponent, type Component } from 'vue';

/** The view a layout plugin supplies for a host slot, or the host's own default. */
export function resolveLayoutView(
  registry: PluginRegistry,
  slot: OverrideSlot,
  fallback: Component,
): Component {
  const loader = registry.overrideFor(slot);
  return loader ? defineAsyncComponent(loader) : fallback;
}
