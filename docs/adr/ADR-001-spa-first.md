# ADR-001: SPA first, server rendering decided in sprint 03

**Status:** accepted (2026-10-15) · **Decides:** frontend rendering model for launch

## Context

The storefront must eventually rank in search (catalog/product pages), but the first milestones
are the plugin architecture, the GraphQL integration and the checkout. Options compared in the
research report: Vue SPA (vbwd pattern), Nuxt SSR, Alokai (no OXID connector exists).

## Decision

Build the host as a **Vue 3 SPA** (Vite), matching the vbwd-fe-user reference and keeping the
plugin contract framework-light. The SEO mechanism (prerender/SSG vs dynamic rendering vs Nuxt
migration) is evaluated and decided in **sprint 03 / ADR-003** — route components and plugins
are kept free of SPA-only assumptions (no `window` access at module top level) so a later SSR
move changes the shell, not the plugins.

## Consequences

- Fast start, smallest ops footprint; catalog SEO is a known debt until sprint 03 lands.
- `/dashboard` (sprint 05) stays pure SPA by design, excluded from indexing in any model.
