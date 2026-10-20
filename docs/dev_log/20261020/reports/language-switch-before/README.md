# Language switch — state before sprint 16 (2026-10-20)

Playwright probe against the tunnelled local instances, waiting for the rendered header.

| Target                                     | Layout  | Result                                                                                                                                                                                                                      |
| ------------------------------------------ | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `https://daniil.oxiddev.de:8443` (default) | host    | `locale-switcher` present: `<select>` with options `EN / DE`. After selecting `de`: `html lang=de`, nav "Daniil Shop Shop Cart" → "Daniil Shop Shop Warenkorb", `localStorage.oxfe_locale=de`; after reload `html lang=de`. |
| `https://daniil.oxiddev.de:2083` (peroxid) | peroxid | `locale-switcher` count 0 on desktop; drawer opened on a 390 px viewport: 0 switchers, 0 selects. Header text "PEROXID SHOP".                                                                                               |

Screenshots: `8443-default-header.png`, `2083-peroxid-header.png`, `2083-peroxid-mobile-menu.png`.
