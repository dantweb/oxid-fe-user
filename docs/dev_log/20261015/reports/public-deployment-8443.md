# Public containerized deployment — https://daniil.oxiddev.de:8443

**Date:** 2026-10-15 · **Proof:** the full Playwright suite (9/9) runs green against this URL,
including checkout to the PayPal sandbox and Stripe-hosted checkout.

## Topology

```
browser ── Cloudflare edge (:443 and :8443, TLS by Cloudflare)
              │  cloudflared tunnel (cf-tunnel-template)
              ▼
         edge-router (nginx, host :8085) — routes by the ORIGINAL Host header,
              │                            which Cloudflare preserves incl. port
              ├─ Host daniil.oxiddev.de:8443 ──► oxid-fe-user-prod (nginx SPA, host :8090)
              │                                     └─ /graphql/, /out/pictures/ → apache (shop)
              └─ default ─────────────────────► apache :80, Host forced to
                                                daniil.oxiddev.de (exactly what the
                                                former ingress httpHostHeader did)
```

- **Why a router:** cloudflared ingress matches hostname only — every edge port lands in the
  same rule. The edge _does_ preserve the port inside the `Host` header
  (`daniil.oxiddev.de:8443`), verified via the router's `/__edge-router-host` diagnostics
  endpoint, so an nginx `map $http_host` can split per port.
- **Shop unchanged:** `:443`/`:80` traffic reaches apache with `Host: daniil.oxiddev.de` as
  before; verified (`/graphql/` 200 after the switch).

## Pieces

| Where                                                                       | What                                                                                                                        |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| SDK `services/oxid-fe-user-prod.yml`                                        | prod image (two-stage Dockerfile build from SDK root), `API_UPSTREAM=http://host.docker.internal`, host port 8090           |
| `~/osc/cf-tunnel-template/edge-router.conf` + compose service `edge-router` | the Host-port router (host :8085)                                                                                           |
| `~/osc/cf-tunnel-template/config.yaml`                                      | ingress → `http://host.docker.internal:8085`, `httpHostHeader` removed (router does it); backup: `config.yaml.bak-20261015` |
| shop `oe_payment_base.yaml`                                                 | `sPaymentBaseHeadlessReturnOrigins: 'http://localhost:5173 https://daniil.oxiddev.de:8443'`                                 |
| fe-user `playwright.config.ts` + specs                                      | `E2E_BASE_URL` points the suite at any deployment (no local webServer then); spec URLs made baseURL-relative                |

## Bug found & fixed by this deployment

**Two Pinia instances in the prod bundle** (`Cannot read properties of undefined (reading '_s')`
in `useAuthStore`): with the `file:../oxid-fe-core` link, Rollup resolved the library's
externalized `pinia`/`vue` imports to `oxid-fe-core/node_modules`, while the app used its own
copies. Dev was immune (Vite pre-bundles deps once), so only the built SPA broke — on every
route that touches a store. Fix: `resolve.dedupe: ['vue', 'pinia', 'vue-router', 'zod']` in the
app's vite config.

## Running the suite against the deployment

```bash
E2E_BASE_URL=https://daniil.oxiddev.de:8443 npx playwright test   # 9/9
```

## Update 2026-10-16 — instances B and C

`:2053` → instance B and `:2083` → instance C (host ports 8091 / 8092) were added to the edge
router; `:8090–8092` themselves cannot pass Cloudflare's proxy — see
`dev_log/20261016/done/sprint-09-peroxid-layout-plugin.md`.
