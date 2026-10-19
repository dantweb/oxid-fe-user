import { z } from 'zod';
import { PRODUCT_LIST_FIELDS, type ProductListItem } from '../shop/api/queries';

/**
 * A front-page product stream. `action` streams read an OXID promotion action (`oxnewest` =
 * "Just arrived", `oxbargain` = "Week's Special"); `category` streams read a category by id.
 */
const streamSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['action', 'category']),
  ref: z.string().min(1),
  limit: z.number().int().min(1).max(24).default(10),
  /** overrides the translated title `peroxid.streams.<id>` */
  title: z.string().optional(),
});

export type StreamConfig = z.infer<typeof streamSchema>;

/** The demo shop's "Elektronik" category — instances name their own category id. */
const ELECTRONICS_CATEGORY_ID = '91c959d1be6af96041072032ead2daf0';

export const DEFAULT_STREAMS: StreamConfig[] = [
  { id: 'new', type: 'action', ref: 'oxnewest', limit: 10 },
  { id: 'sales', type: 'action', ref: 'oxbargain', limit: 10 },
  { id: 'electronic', type: 'category', ref: ELECTRONICS_CATEGORY_ID, limit: 10 },
];

/** Validates `plugins.peroxid.config.streams` from oxid-config.yaml; a typo stops the boot loudly. */
export function parseStreams(raw: unknown): StreamConfig[] {
  const result = z.array(streamSchema).min(1).safeParse(raw);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    throw new Error(`peroxid: invalid streams configuration — ${problems}`);
  }
  return result.data;
}

interface StreamRequest {
  document: string;
  variables: Record<string, unknown>;
  /** extracts the product list from the GraphQL data */
  pick(data: Record<string, unknown>): ProductListItem[];
}

export function streamRequest(stream: StreamConfig): StreamRequest {
  if (stream.type === 'action') {
    return {
      document: `query streamAction($id: ID!) { action(actionId: $id) { products { ${PRODUCT_LIST_FIELDS} } } }`,
      variables: { id: stream.ref },
      pick: (data) =>
        ((data.action as { products?: ProductListItem[] } | null)?.products ?? []).slice(
          0,
          stream.limit,
        ),
    };
  }
  return {
    document: `query streamCategory($id: ID!, $limit: Int!) {
      products(filter: { category: { equals: $id } }, pagination: { offset: 0, limit: $limit }) { ${PRODUCT_LIST_FIELDS} }
    }`,
    variables: { id: stream.ref, limit: stream.limit },
    pick: (data) => (data.products as ProductListItem[] | undefined) ?? [],
  };
}
