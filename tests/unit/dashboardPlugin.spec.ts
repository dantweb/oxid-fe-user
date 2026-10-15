import { readFileSync } from 'node:fs';
import { PluginRegistry } from '@dantweb/oxid-fe-core';
import { describe, expect, it } from 'vitest';
// @ts-expect-error untyped build script helpers (plain .mjs by design)
import { buildSeoRoutes } from '../../scripts/seo-lib.mjs';
import dashboardPlugin from '../../plugins/dashboard';

describe('dashboard plugin', () => {
  it('guards every route with requiresAuth', () => {
    expect(dashboardPlugin.routes?.length).toBeGreaterThan(0);
    for (const route of dashboardPlugin.routes ?? []) {
      expect(route.meta?.requiresAuth, `${route.path} must require auth`).toBe(true);
    }
  });

  it('contributes an auth-only nav item', () => {
    const registry = new PluginRegistry();
    registry.register(dashboardPlugin);
    expect(registry.navItems).toEqual([
      { labelKey: 'dashboard.nav', to: '/dashboard', order: 80, requiresAuth: true },
    ]);
  });

  /**
   * Sprint-05 contract: /dashboard never leaks into the index — not via the
   * prerender/sitemap route list and not via robots.txt. A later route addition
   * that breaks this fails here.
   */
  it('is excluded from SEO: route list and robots.txt', () => {
    const seoRoutes: string[] = buildSeoRoutes(['p1', 'p2']);
    expect(seoRoutes.some((route) => route.startsWith('/dashboard'))).toBe(false);

    const robots = readFileSync('public/robots.txt', 'utf-8');
    expect(robots).toContain('Disallow: /dashboard');
  });
});
