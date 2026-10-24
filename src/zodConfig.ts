import { configureZodForCsp } from '@dantweb/oxid-fe-core/zod-csp';

// Zod 4 compiles object parsers with `new Function`. The storefront has no CSP today, but a host that adds one
// (no 'unsafe-eval', Trusted Types) would get a violation report on every parser, so interpreted parsing is the
// default. This is the first import of `main.ts`: zod decides when a schema is created, and schemas are created
// while the other modules load. The `/zod-csp` entry of core creates no schema itself.
configureZodForCsp();
