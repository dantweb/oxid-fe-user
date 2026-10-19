import { PRODUCT_LIST_FIELDS } from '../api/queries';

export const SEARCH_QUERY = `query search($q: String!, $limit: Int!, $offset: Int!) {
  products(filter: { title: { contains: $q } }, pagination: { offset: $offset, limit: $limit }) { ${PRODUCT_LIST_FIELDS} }
}`;
