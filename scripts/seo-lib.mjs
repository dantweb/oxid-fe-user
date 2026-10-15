/**
 * Pure helpers shared by generate-sitemap.mjs and prerender.mjs (unit-tested).
 */

export function xmlEscape(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

/** Indexable route list for sitemap AND prerenderer — one source of truth. */
export function buildSeoRoutes(productIds) {
  return ['/', '/shop', ...productIds.map((id) => `/shop/product/${encodeURIComponent(id)}`)];
}

export function sitemapXml(origin, routes, lastmod) {
  const base = origin.replace(/\/$/, '');
  const urls = routes
    .map(
      (route) =>
        `  <url><loc>${xmlEscape(base + route)}</loc><lastmod>${xmlEscape(lastmod)}</lastmod></url>`,
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

/** Filesystem path (relative to dist/) where a route's snapshot lands. */
export function snapshotPath(route) {
  return route === '/' ? 'index.html' : `${route.replace(/^\//, '')}/index.html`;
}
