# Layout plugins — plugins that override the host's views

Most plugins **add** things (routes, nav entries, payment methods). A **layout plugin** also
**replaces** parts of the host's default layout. Switch it on in the instance's
`oxid-config.yaml` and the default header/footer/front page are gone, replaced by the plugin's.
Switch it off and the defaults are back — nothing else changes.

## The override mechanism

An `IPlugin` may declare:

```ts
interface IPlugin {
  // …name, version, routes, navItems, messages, defaultConfig, setup (see plugin-contract.md)

  /** Views this plugin takes over from the host. */
  overrides?: Partial<Record<'header' | 'footer' | 'home', () => Promise<{ default: Component }>>>;
  /** Plugins that must be registered for this one to work (checked at boot, clear error). */
  requires?: string[];
  /** The theme this plugin brings along and is designed for (see "Plugin + theme" below). */
  defaultTheme?: string;
}
```

| Slot     | What it replaces                                                    |
| -------- | ------------------------------------------------------------------- |
| `header` | the app header (brand, navigation, login/logout, language switcher) |
| `footer` | the app footer                                                      |
| `home`   | the front page (`/`)                                                |

- The host resolves a slot with `registry.overrideFor(slot)`: if several enabled plugins
  override the same slot, **the one listed last in `oxid-config.yaml` wins** (deterministic,
  visible in one file). No override → the host's own component.
- An override component is a normal Vue component. It gets everything through the plugin's
  `setup(ctx)` context (client, auth, events, registry, config) — the rule "views never import
  from the host" holds for layout plugins too.
- `requires` fails fast: enabling `peroxid` without `shop` stops the boot with
  _"plugin "peroxid" requires "shop", which is not enabled"_ instead of a half-working page.

## Plugin + theme

A layout plugin is the _structure_; a theme is the _look_ (`theming.md`). A layout plugin that
ships its own theme declares it as its **`defaultTheme`**. Which theme an instance runs is
resolved:

1. `theme.active` in `oxid-config.yaml`, if set — the instance's explicit choice always wins;
2. else the `defaultTheme` of an enabled plugin (the first that declares one);
3. else `theme.default` (the instance's fallback theme).

So enabling the plugin alone gives the intended look, and an instance can still override it.
The plugin only uses design tokens (`--oxfe-*`, see `theming.md`), so it also works — less
polished — on any other theme.

## `peroxid` — the first layout plugin (its `defaultTheme` is the `peroxid` theme)

A modern, premium ("high-end boutique") storefront layout: ivory and obsidian, brass accent,
Roboto sans-serif type.

**Header** — fixed content width **1200 px**, fluid below that (`width: min(1200px, 100% − gutters)`),
sticky:

- brand (the theme logo, or the shop name as a wordmark), primary navigation from the enabled
  plugins' nav items;
- **search** in the header: type-ahead suggestions (storefront `products(filter: {title})`),
  Enter opens `/search?q=…` with paged results;
- account entry and the **cart as an icon**: a badge shows the **number of distinct SKUs** in the
  cart (two units of one product count once); hidden when the cart is empty;
- phones: navigation behind a menu button, search behind a search button that opens a full-width
  row; every control is a ≥ 44 × 44 px tap target.

**Front page** (`home` override) — a **hero block** and three **product streams** (horizontal,
swipeable rails with snap points; arrow buttons where a mouse exists):

| Stream                     | Source in OXID                                  | Default                              |
| -------------------------- | ----------------------------------------------- | ------------------------------------ |
| `new` — New arrivals       | promotion action `oxnewest` ("Just arrived")    | `type: action, ref: oxnewest`        |
| `sales` — Today's offers   | promotion action `oxbargain` ("Week's Special") | `type: action, ref: oxbargain`       |
| `electronic` — Electronics | a category (the demo shop's "Elektronik")       | `type: category, ref: <category id>` |

Streams are configured per instance:

```yaml
plugins:
  peroxid:
    config:
      streams:
        - { id: new, type: action, ref: oxnewest }
        - { id: sales, type: action, ref: oxbargain, limit: 10 }
        - { id: electronic, type: category, ref: 91c959d1be6af96041072032ead2daf0 }
```

`id` selects the translated title (`new`, `sales`, `electronic`); a `title` key overrides it.
A stream with no products is not rendered.

**Footer** — a quiet, matching footer.

## Responsiveness proof

`tests/e2e/peroxid-responsive.spec.ts` runs the layout on real device profiles — **iPhone 17
Pro in the WebKit engine**, and the Samsung screens **Galaxy S24, Galaxy S25 Ultra and Galaxy Z
Fold 7** — and asserts: no horizontal overflow, header inside the viewport, ≥ 44 px tap targets,
working search and menu, correct cart badge, hero text inside the viewport, rails scrollable with
the next card peeking. Screenshots are kept in `docs/dev_log/<day>/reports/peroxid-responsive/`.
`peroxid.spec.ts` proves the desktop behavior (header exactly 1200 px at wide viewports, fluid
below) and that the plugin really overrides the defaults.
