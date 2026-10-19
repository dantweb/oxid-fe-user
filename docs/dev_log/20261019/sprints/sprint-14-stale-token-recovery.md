# Sprint 14 — a stale access token must never lock the visitor out

**Date:** 2026-10-19 · **Repos:** `oxid-fe-core` (`GraphqlClient`, `AuthService`, `TokenStorage`), `oxid-fe-user` (follow-through, e2e); `hydroxid-project` pin bump
**Binding rules:** [`_engeneering_requirements.md`](./_engeneering_requirements.md) (TDD, SOLID, DRY, Clean code, No overengineering) plus the repo-wide file it extends.

## Ask

On `https://pay1.oxid.dev:2053` the visitor could not log in: every GraphQL answer was
`{"errors":[{"message":"The access token is invalid"}]}`. Fix the stale-token handling so a dead
token heals itself instead of blocking the app.

## Diagnosis (verified against the live shop, 2026-10-19)

| Request sent to `/graphql/`                    | Answer                                                                                                        |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `token(username, password)` with **no** bearer | works (wrong password → "Username/password combination is invalid")                                           |
| the same query **with any bearer token**       | `Unable to parse token` (garbage) / `The access token is invalid` (well-formed JWT, bad signature or expired) |
| `{ __typename }` with a bearer                 | same error, i.e. even harmless reads are refused                                                              |

So the shop checks the `Authorization` header **before** it looks at the query. Both messages come
without `extensions.errorCode`.

In core:

- `TokenStorage` keeps the token in `localStorage` (`oxfe.token`) until someone clears it.
- `GraphqlClient.buildHeaders()` adds `Authorization: Bearer …` to **every** request, including
  the `token` query that is meant to replace a bad token.
- `AuthService.hasValidToken()` only checks the JWT's `exp` claim. A token that is unexpired but
  rejected by the shop (signing key changed after a redeploy, token minted by another shop or
  environment on the same origin, shop DB reset) counts as valid forever.
- Session-expiry detection is client-side only; nothing reacts to the **server** saying no.

Result: a stale token is a dead end. Login sends the stale token, the shop refuses, the stored
token stays, the next try fails the same way. Only "Clear site data" helps.

## Design

One rule: **the server's refusal of the token is the truth.** When it says the token is bad, drop
it and carry on anonymously.

- **Classify in one place.** A small pure function `isRejectedToken(errors)` in core matches
  `extensions.errorCode === 'invalid_token'` or the two known messages (`The access token is
invalid`, `Unable to parse token`). The messages are a fallback because the shop sends no code
  today; the sprint also files the backend ask (see Risks).
- **Heal in `AuthService`, not in the client** (SRP: the client transports, auth owns the token).
  The client gets one opt-in hook, `onTokenRejected`, installed by `AuthService`; the client calls it
  and knows nothing about storage.
- **On rejection:** clear the token, emit `AuthLogout`/`SessionExpired` (the existing events, so
  stores and UI already react), then
  - **queries** are retried **once** without a token;
  - **mutations** are not replayed automatically (could double an action); the error is thrown and
    the visitor sees the normal "session expired, log in again" state.
- **Never send a token with the `token` query.** Login and anonymous-token requests go out
  without `Authorization`, so they cannot be refused by the very credential they replace. Done by an
  explicit per-call option, not by sniffing the query text for "token".
- **Sanity on start.** A stored value that does not parse as a JWT is dropped at read time
  (`TokenStorage` consumer), so garbage never leaves the browser.

Not built: refresh tokens, silent re-login, token revalidation polling, a retry framework.

## Stories

| #   | Story (test first)                                                                                                                                                                                                                                                                           |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | **Reproduce, red.** Unit tests in core (`GraphqlClient.spec`, `AuthService.spec`) for: bad token → login still works; rejected token is cleared. Plus a Playwright test in `oxid-fe-user` that seeds `localStorage['oxfe.token']` with a forged well-formed JWT and logs in. It fails today. |
| S2  | `isRejectedToken(errors)` (pure, table-driven test: both messages, `invalid_token`, unrelated errors → false).                                                                                                                                                                               |
| S3  | Login/anonymous-token calls carry no `Authorization` (per-call option on `execute`; default unchanged for every other consumer).                                                                                                                                                             |
| S4  | `onTokenRejected` hook on `GraphqlClient`; `AuthService` clears the token, emits the session event, and the client retries a **query** once without a token. Mutations are not retried. Test both, and that the retry happens at most once (no loop).                                        |
| S5  | Drop a stored token that is not a parseable JWT at read time. Test with garbage, empty string, three-part non-base64.                                                                                                                                                                        |
| S6  | e2e through the public ports (`:2053`, `:2083`, `:8443`): stale token in storage → page loads as a guest, login succeeds, a logged-in action works, the stale token is gone from storage. Screenshot in `reports/`.                                                                          |
| S7  | Docs (`oxid-fe-core` README/auth section, `docs/architecture.md`), report, quality gate in core and user, release in order **core → user (tag) → hydroxid pin bump**, status.md.                                                                                                             |

## Acceptance

- With a stale or forged token in the browser the storefront still loads, login works on the first
  try, and no manual "clear site data" is needed.
- A request refused for its token is retried at most once, and only if it is a query.
- No request to the shop carries a token that the shop has already rejected.
- The live reproduction on `pay1.oxid.dev:2053` no longer happens after the pin bump.
- Gates green: lint, type-check, knip, coverage (core ≥ 90%), build; e2e green.

## Out of scope (deferred, not built)

Refresh-token flow, background token validation, per-tab token sync, cookie-based sessions.

## Risks

- Matching on message text is brittle. It is a stopgap; the durable fix is the shop returning
  `extensions.errorCode: invalid_token`. File that against graphql-base; the matcher then keeps the
  code check and the messages can be removed.
- Retrying a query after dropping the token can show guest data for a moment. Accepted: the
  session-expired event tells the UI to ask for login.

## Outcome (as built, 2026-10-19)

- **core:** `isRejectedToken` (code `invalid_token` or the two known messages), `execute(…, { omitToken })`, `setTokenRejectedHandler`; `AuthService` installs the handler (drops the token, `SessionExpired` for a customer only), sends the token calls with `omitToken`, drops a non-JWT stored value on read. 114 unit tests, 98% lines; red first (15 failing) then green.
- **user:** `tests/e2e/stale-token.spec.ts`. Run against core `main` it fails (storefront and login are blocked by a forged token — the reported bug); with the fix all 3 pass.
- **Deviation:** S6 ran against the local dev server and the SDK shop, not the public ports `:2053/:2083/:8443` (those need a deployed build). Re-run there after release: `E2E_BASE_URL=… npx playwright test stale-token`.
- **Backend ask (open):** graphql-base should answer with `extensions.errorCode: invalid_token`; then the message matching in `rejectedToken.ts` can go.
