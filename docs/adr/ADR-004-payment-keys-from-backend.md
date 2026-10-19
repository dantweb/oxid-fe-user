# ADR-004: Payment provider keys come from the backend, sealed

**Status:** accepted (2026-10-19) · **Decides:** where provider keys live and how the storefront gets them

## Context

`oxid-config.yaml` carried the Stripe publishable key, the PayPal client id and the Mollie profile id.
The build renders it into `/oxid-config.json`, served to everyone, and it sits in git. Provider
keys belong to the shop's module settings.

## Decision

The storefront asks the shop for them (`paymentClientConfig`), with a session token and a fresh
ECDH P-256 key, and receives an AES-256-GCM envelope (spec: `docs/payments-keys.md`). The sealing lives
once in `payment-base`; every payment module only contributes an allow-listed provider. A failed
exchange switches the plugin to the hosted redirect flow, never to a built-in key. The config loader
rejects key fields.

## Consequences

- No key in git, in the build or in anything served to anonymous clients; only ciphertext on the wire.
- The visitor's browser still holds the public key after decryption — inherent to provider SDKs.
- Needs `payment-base` and the three modules to ship before the frontend drops its YAML keys.
- Rotating the already published keys is a separate, manual step at the providers.
