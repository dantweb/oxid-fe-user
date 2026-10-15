/** Shared impure bits of the SEO scripts: env resolution and the catalog query. */

export function seoEnv() {
  return {
    origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173',
    shopUrl: (process.env.VITE_SHOP_URL ?? 'http://localhost.local').replace(/\/$/, ''),
    limit: Number(process.env.SEO_PRODUCT_LIMIT ?? 48),
  };
}

export async function fetchProductIds(limit) {
  const { shopUrl } = seoEnv();
  const response = await fetch(`${shopUrl}/graphql/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 (seo-build)' },
    body: JSON.stringify({
      query: `query seoProducts($limit: Int!) {
        products(pagination: { offset: 0, limit: $limit }) { id }
      }`,
      variables: { limit },
    }),
  });
  const body = await response.json();
  if (body.errors?.length) {
    throw new Error(`storefront query failed: ${body.errors[0].message}`);
  }
  return body.data.products.map((product) => product.id);
}
