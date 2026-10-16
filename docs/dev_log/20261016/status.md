# Status — 2026-10-16

| Item                                                      | Status  | Proof                                                                                                                                                                                                                                          |
| --------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CI: oxid-fe-user green (read-only deploy key)             | ✅ done | [00c report](../20261015/done/sprint-00c-github-repos.md)                                                                                                                                                                                      |
| Deployment config `oxid-config.yaml` live on `:8443/shop` | ✅ done | `deployed-config.spec` (4) on the public URL; live-edit demo; language order fix                                                                                                                                                               |
| 09 peroxid layout plugin + peroxid theme                  | ✅ done | override on/off, 1200 px header, SKU badge, 3 streams = shop data, search; iPhone 17 Pro (WebKit) + Galaxy S24 / S25 Ultra / Z Fold 7 ([report](done/sprint-09-peroxid-layout-plugin.md), [screenshots](reports/peroxid-responsive/README.md)) |

**Known debt:** shopper-facing theme/layout switcher not built; prerendered SEO snapshots are
per build config (instances with other languages need their own SEO build).
