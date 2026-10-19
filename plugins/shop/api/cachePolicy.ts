import type { ExecuteOptions } from '@dantweb/oxid-fe-core';

/**
 * How long a repeated read may be served from memory. Short on purpose — prices and stock must
 * not look stale. Applied to catalog reads only; basket, account, checkout and payment calls
 * never opt in (guarded by tests/unit/cachePolicy.spec.ts).
 */
export const CATALOG_READ: ExecuteOptions = { cacheTtlMs: 60_000 };

/** Type-ahead suggestions repeat fast (backspace, retype) and can be a little shorter-lived. */
export const SUGGESTION_READ: ExecuteOptions = { cacheTtlMs: 30_000 };
