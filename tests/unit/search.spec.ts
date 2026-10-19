import { describe, expect, it } from 'vitest';
import { SEARCH_QUERY } from '../../plugins/shop/search/searchQuery';
import de from '../../plugins/shop/i18n/de.json';
import en from '../../plugins/shop/i18n/en.json';

describe('shop search', () => {
  it('searches product titles (contains — the shop core gets no index) with the typed variables the storefront expects', () => {
    expect(SEARCH_QUERY).toContain('$q: String!');
    expect(SEARCH_QUERY).toContain('filter: { title: { contains: $q } }');
  });

  it('has the same copy keys in both languages', () => {
    expect(Object.keys(de.search).sort()).toEqual(Object.keys(en.search).sort());
  });
});
