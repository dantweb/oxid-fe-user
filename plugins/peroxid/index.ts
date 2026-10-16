import type { IPlugin, PluginContext } from '@dantweb/oxid-fe-core';
import de from './i18n/de.json';
import en from './i18n/en.json';
import { DEFAULT_STREAMS, parseStreams, type StreamConfig } from './streams';

let context: PluginContext | null = null;
let streams: StreamConfig[] = DEFAULT_STREAMS;

export function usePeroxidContext(): PluginContext {
  if (!context) {
    throw new Error('peroxid plugin is not set up');
  }
  return context;
}

export const useStreams = (): StreamConfig[] => streams;

/**
 * Layout plugin (docs/layout-plugins.md): takes over the header, the footer and the front page,
 * adds site search. Works on any theme; its `defaultTheme` is the partner look.
 */
const plugin: IPlugin = {
  name: 'peroxid',
  version: '0.1.0',
  requires: ['shop'],
  defaultTheme: 'peroxid',
  overrides: {
    header: () => import('./components/PeroxidHeader.vue'),
    footer: () => import('./components/PeroxidFooter.vue'),
    home: () => import('./views/PeroxidHome.vue'),
  },
  routes: [{ path: '/search', component: () => import('./views/SearchView.vue') }],
  messages: { en, de },
  defaultConfig: { streams: DEFAULT_STREAMS },
  setup(ctx) {
    context = ctx;
    streams = parseStreams(ctx.config.streams);
  },
};

export default plugin;
