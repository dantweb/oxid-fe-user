# Sprint 15 — payment provider keys come from the backend, over a protected exchange

**Date:** 2026-10-19 · **Repos:** `oxid-fe-core` (payment plugin contract), `oxid-fe-user` (`payment-stripe`, `payment-paypal`, `payment-mollie`, instance configs, docs), the shop modules (Stripe, PayPal, Mollie) for the endpoint; `hydroxid-project` follow-through
**Binding rules:** [`_engeneering_requirements.md`](./_engeneering_requirements.md) (TDD, SOLID, DRY, Clean code, No overengineering) plus the repo-wide file it extends.
**Spec to write first:** `docs/payments-keys.md`; ADR for the exchange.

## Ask

The payment plugins keep their provider keys in `oxid-config.yaml`:

```yaml
payment-paypal:
  config: { mode: iframe, client_id: BAAWEN…, currency: EUR, intent: capture }
payment-stripe:
  config: { mode: iframe, publishable_key: pk_test_51TuDSd… }
```

That is wrong. Such keys **always live in the backend** (the shop's module settings) and the
frontend may get them **only through an encrypted exchange**, so nobody watching the traffic or the
browser's request history can read or decrypt them.

## Starting point (verified in code)

- `plugins/payment-stripe/index.ts` reads `config.publishable_key`; `plugins/payment-paypal/index.ts`
  reads `config.client_id`; Mollie reads `profile_id`, `test_mode`.
- `oxid-config.yaml.dist`, `instances/example-b`, `instances/example-peroxid` and the
  `hydroxid-project` instances hold real test keys. The build renders them into
  `oxid-config.json`, which `nginx` serves **unauthenticated, uncached, to everyone** at
  `/oxid-config.json`. They are also in git.
- `docs/payments.md` documents "public by design" values in the YAML. That text is replaced.
- The shop already holds the same values (`sStripeTestPk`/`sStripeLivePk`, `sPayPalSandboxClientId`/
  `sPayPalLiveClientId`, `sMollieProfileId`, `sMollieMode`) and already runs the `*CheckoutStart`
  mutations.

## What this sprint can and cannot promise (decision to confirm)

Stripe.js, PayPal's SDK and Mollie Components **must be initialised in the visitor's browser with
the key**; the browser then sends it to the provider. So the visitor's own browser, and anyone with
access to it, can always see it after use. What the exchange does guarantee, and what this sprint
builds:

1. The key is **not in the repo, the build, the static config or any file served to anonymous
   clients.** It exists in the browser only after a session-bound request.
2. Between shop and browser the value is **sealed**: it does not appear in plaintext in the
   response body, so proxies, CDN/Cloudflare logs, access logs, HAR exports of the request history
   and "view-source" give only ciphertext.
3. A secret key (`sk_…`, PayPal secret, Mollie API key) is **never** sent to the frontend, by
   design of the endpoint (allow-list, not deny-list). Only the public half a provider SDK needs.

If the requirement is that even the visitor's browser must not hold the public key, the answer is a
hosted/redirect flow (`mode: redirect`), which the plugins already support. That stays available.

## Design

### Backend (shop modules)

One query, `paymentClientConfig(provider: String!)`, behind the existing token (guests get an
anonymous token, so checkout works for guests):

- returns the **allow-listed** public values for that provider from the shop's module settings and
  the current mode (test/live), as an **encrypted envelope** `{ v, alg, iv, ciphertext }`;
- refuses unknown providers; never returns anything not on the allow-list.

### The sealed exchange (one place, in core)

- The browser creates an ephemeral key pair per page load with WebCrypto (ECDH P-256, non-extractable
  private key), sends the **public** key with the request; the shop derives a shared secret
  (HKDF), seals the payload with AES-256-GCM, returns the envelope; the browser derives the same
  secret and decrypts in memory. The private key never leaves the browser and is discarded after.
- Bound to the session token and to a short timestamp, so a replayed envelope is useless.
- TLS stays on top; the seal is defence in depth for the places TLS ends (CDN, reverse proxy, logs).
- Uses only `crypto.subtle` (no library). Failure (no WebCrypto, decrypt error) → the plugin falls
  back to `redirect` mode, never to a hard-coded key.

### Frontend

- New core module `fetchSealedConfig(client, provider)` (SRP: fetch + unseal, nothing about
  providers). Each payment plugin asks for its values at checkout time and keeps them in memory
  only (no `localStorage`, no cache entry: excluded from `ResponseCache`).
- `oxid-config.yaml` keeps only **non-secret, non-key** behaviour per plugin: `mode`, and
  display options (`methods`, `currency` if the shop does not own it). The loader **rejects**
  a config that still contains a key field (`publishable_key`, `client_id`, `profile_id`, any
  `*_key`/`*secret*`) with a clear error, so the old shape cannot come back.

## Stories

| #   | Story (test first)                                                                                                                                                                                                                                                              |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | Docs first: `docs/payments-keys.md` + ADR (threat model, what is and is not protected, the envelope format). Confirm the decision in "What this sprint can and cannot promise" before S3.                                                                                       |
| S2  | **Red tests:** the config loader rejects key fields in `plugins.payment-*.config`; the dist and instance YAMLs fail the rule today.                                                                                                                                             |
| S3  | Core `fetchSealedConfig`: unit tests with fixed vectors (encrypt in the test with Node's `crypto`, decrypt through the module), tamper → error, wrong key → error, replay beyond the window → error. No key material in logs.                                                   |
| S4  | Backend: `paymentClientConfig` in the Stripe, PayPal and Mollie shop modules (module branches, with their own tests); allow-list tested; `sk_…`-shaped values can never be returned (test).                                                                                     |
| S5  | `payment-stripe`, `payment-paypal`, `payment-mollie` use `fetchSealedConfig`; on failure fall back to `redirect`. Unit tests with the existing fixtures swapped to the sealed source; existing `paymentProviders.spec` updated.                                                 |
| S6  | Remove the keys from `oxid-config.yaml.dist`, `instances/*`, `hydroxid-project` instances and the rendered `oxid-config.json`; keep `mode`. `nginx` serves nothing key-shaped (test greps the built `dist/` and `oxid-config.json`).                                            |
| S7  | e2e on the public ports (`:2053`, `:2083`, `:8443`): complete a real sandbox payment per provider; assert the HAR of the whole run contains **no** `pk_…`/client id in plaintext, and `/oxid-config.json` has none.                                                             |
| S8  | **Rotate.** The keys quoted above were committed and served publicly. Publishable/client ids are not secret in the provider's model, but rotate them anyway and purge from history only if you decide to; record it. Docs, report, gates, release order core → user → hydroxid. |

## Acceptance

- No payment key in any file in git, in `dist/`, or in `/oxid-config.json` (a test greps all three).
- The loader refuses a config that contains one.
- Keys reach the browser only through `paymentClientConfig`, sealed; the HAR of a full checkout shows
  only ciphertext for them.
- A payment completes per provider with the sealed key; with the exchange blocked, the plugin falls
  back to `redirect` and the payment still completes.
- No secret key is obtainable through the endpoint (negative test).
- Gates green in core, user and hydroxid; e2e green; shop module tests green.

## Out of scope (deferred, not built)

Per-merchant key rotation UI, hardware-bound keys, replacing the providers' SDKs, a general
"encrypted config" channel for non-payment plugins.

## Risks

- **The browser can always read what it decrypts.** Stated above; the sprint hides the key from the
  repo, static hosting and the wire, not from the visitor's own device.
- Crypto code is easy to get subtly wrong. Use only standard WebCrypto primitives, fixed test vectors
  and a review by someone who is not the author; no home-made scheme.
- Needs matching changes in three shop modules; the frontend sprint cannot ship alone. Order:
  backend modules first, then core, user, hydroxid.
- Existing deployments break when the YAML keys are rejected; the loader error names the field and
  points to the docs.

## Outcome (as built, 2026-10-19)

**Done and verified**

- **S1:** `docs/payments-keys.md` + ADR-004; the decision "the browser can always read what it decrypts; hosted redirect is the fallback" was taken as written. Shared test vector `oxid-fe-core/tests/fixtures/sealed-config-vector.json`.
- **S2:** `renderPublicConfig` refuses key fields (`publishable_key`, `client_id`, `profile_id`, anything with `key`/`secret`) in `payment-*` plugin config, naming the path and pointing to the docs. Red first on the shipped YAMLs.
- **S3 (core):** `fetchSealedConfig` (WebCrypto ECDH P-256 + HKDF-SHA256 + AES-256-GCM), `createSealedKeys`/`sealedKeysForPlugin`. 140 core tests, 98% lines. The vector made by Node crypto is opened by the browser code; tamper, wrong provider, wrong session and replay-window cases fail as required.
- **S4 (backend, local commits only, not pushed):** payment-base `0a11f50` (query `paymentClientConfig`, sealer, guard, registry; the PHP sealer reproduces the shared vector byte for byte; 47 new tests, phpcs/phpstan max/phpmd green) and one provider per module: stripe `a84373a`, paypal `2cbcaff`, mollie `95223f2`. Each lives in `<module>/.claude/worktrees/sealed-client-config` on branch `feature/sealed-client-config`.
- **S5:** the three plugins fetch their key when the inline component mounts, before anything is started at the shop; any failure flips a reactive flag and the checkout uses the hosted page — never a built-in key.
- **S6:** keys removed from `oxid-config.yaml.dist`, the example instances and the HydroXid instances; `test_mode` too (the shop decides). A test greps all tracked files and `dist/` for key-shaped values.
- Gates green in core, user and hydroxid-project; user e2e (all but `payments-*`/evidence): 71 passed.

**Not done / not verified — read before relying on it**

- **S7 not run:** no sandbox payment with a sealed key and no HAR assertion. It needs the new `payment-base` and the three module providers installed and activated in a running shop; the shop in this session still runs the old module code. Until then the real flow end to end is unproven.
- **Backend runtime unverified:** nothing ran against the real graphql-base/GraphQLite schema. In particular a guest token calling `paymentClientConfig` (access by `#[Right]` only, no `#[Logged]`) and the type's `v` / `issuedAt` fields must be checked once with a real token after activating the modules. The DI wiring was only compiled in a throwaway container.
- **Order/constraints:** stripe and mollie `composer.json` still say `payment-base >=1.3`/`>=1.2`; they need `>=1.4` once payment-base ships the interface. The paypal worktree is based on the local `origin/main` ref (a fetch failed, so it may be stale). The mollie worktree is based on `origin/main`, which has no `CHANGELOG.md`; its entry text is in the agent report, to add when the file exists.
- **Until the backend ships, existing deployments fall back to the hosted pages** (Stripe Checkout, PayPal approval page, Mollie page): payments still work, but not inline.
- **S8 (rotation) not done:** it is a manual step at Stripe, PayPal and Mollie. The old publishable key, client id and profile id were committed and served publicly and remain in git history; public ids are not secret in the providers' model, but rotate them if you want them gone.
