# Payment provider keys — from the backend, over a sealed exchange

Sprint 15. The payment plugins no longer carry provider keys in `oxid-config.yaml`. The shop (its
module settings) is the only owner; the storefront receives the **public** values a provider SDK
needs through one session-bound query, sealed so that only the browser that asked can read them.

## What is and is not protected (decision, 2026-10-19)

Stripe.js, PayPal's SDK and Mollie Components must be initialised **in the visitor's browser with
the key**, and the browser then sends it to the provider. So the visitor's own browser can always see
the key after use. The exchange guarantees:

1. **Not in git, not in the build, not in anything served to anonymous clients.** The keys leave the
   shop only for a request that carries a session token and a fresh browser-made key.
2. **Not in plaintext on the wire.** The response body holds ciphertext, so proxies, CDN/Cloudflare
   logs, access logs, HAR exports of the request history and "view source" show nothing usable.
3. **Never a secret.** The endpoint is an allow-list per provider. `sk_…`, PayPal secrets and Mollie
   API keys cannot be returned (tested).

Not protected: the visitor's own device after decryption. If even that is unacceptable, use
`mode: redirect` (hosted provider page), which stays supported and is also the **fallback** when the
exchange fails. TLS stays on top; the seal is defence in depth where TLS ends (CDN, proxy, logs).

## The query

```graphql
query paymentClientConfig($provider: String!, $clientPublicKey: String!) {
  paymentClientConfig(provider: $provider, clientPublicKey: $clientPublicKey) {
    v
    alg
    serverPublicKey
    salt
    iv
    issuedAt
    ciphertext
  }
}
```

- Needs the normal bearer token (a guest's anonymous token is enough). Never cached by the client.
- `provider`: `stripe` | `paypal` | `mollie`. Unknown → error.
- Allow-listed values (plaintext JSON object, string/boolean values only):

| provider | values                  |
| -------- | ----------------------- |
| `stripe` | `publishableKey`        |
| `paypal` | `clientId`              |
| `mollie` | `profileId`, `testMode` |

## The envelope (version 1)

All binary values are **base64url without padding**.

1. Browser: ephemeral ECDH key pair, curve **P-256**, private key non-extractable, new per page load.
   `clientPublicKey` = raw uncompressed point (65 bytes: `0x04 ‖ X ‖ Y`).
2. Shop: ephemeral P-256 key pair; `secret = ECDH(serverPrivate, clientPublic)` (32 bytes).
3. `salt` = 32 random bytes. `aad` = the string `oxid-pcc|v1|<provider>|<issuedAt>|<tokenId>`
   where `issuedAt` is the Unix time in seconds and `tokenId` is the `tokenid` claim of the bearer
   JWT (empty string if absent).
4. `key = HKDF-SHA256(secret, salt, info = aad bytes, length = 32)`.
5. `iv` = 12 random bytes. `ciphertext = AES-256-GCM(key, iv, aad as additional data, plaintext JSON)`
   with the 16-byte tag **appended** to the ciphertext.
6. Envelope: `{ v: 1, alg: "ECDH-P256+HKDF-SHA256+A256GCM", serverPublicKey (raw 65 bytes), salt, iv, issuedAt, ciphertext }`.

The browser rebuilds `aad` from **its own** provider and token id and the envelope's `issuedAt`, derives
the same key and decrypts. Anything else fails: a tampered field, another provider, another session
token (the envelope is bound to the token), a wrong key. It also refuses an `issuedAt` more than
**120 seconds** from its own clock, so a replayed envelope is useless. Standard primitives only
(WebCrypto in the browser, OpenSSL in PHP) — no home-made scheme.

**Test vector:** `oxid-fe-core/tests/fixtures/sealed-config-vector.json` — throw-away keys, fixed salt
and iv, expected envelope. Core must decrypt it; the PHP sealer, given the same server key, salt, iv and
`issuedAt`, must produce exactly that envelope.

## Frontend

- `fetchSealedConfig(client, provider, { tokenId })` in oxid-fe-core: generates the key pair, asks,
  unseals, returns the values. It knows nothing about providers.
- Each payment plugin asks when its inline component mounts and keeps the values in memory only. If
  the exchange fails (no WebCrypto, error, tampered answer), the plugin switches itself to the hosted
  redirect flow; it never falls back to a built-in key.
- `oxid-config.yaml` keeps only non-key behaviour (`mode`, `currency`, `intent`). The loader
  **rejects** a payment plugin config that still contains a key field (`publishable_key`, `client_id`,
  `profile_id`, or any name containing `key`/`secret`).

## Backend

`payment-base` (shared by the three modules) owns the query, the sealing and a
`ClientConfigProviderInterface`; each module registers one provider that returns its allow-listed
values from its module settings and the current test/live mode.
