import { MAX_PAGES } from '../../../plugins/shop/search/searchApi';
import type { Scenario } from './searchBenchmark';
import type { PredicateName } from './sqlProbe';

/** What a shopper does in the quicksearch, from cheap (many matches end the scan early) to worst case. */
export const SCENARIOS: Scenario[] = [
  { name: 'typing', term: 'me', page: null },
  { name: 'typing', term: 'metal', page: null },
  { name: 'typing', term: 'metal rod U', page: null },
  { name: 'typing', term: 'metal rod U-shape AlTi', page: null },
  { name: 'shape', term: 'U-shape AlTi', page: null },
  { name: 'selective', term: 'FeMoCo 999mm length 99mm', page: null },
  { name: 'short', term: 'Zn', page: null },
  { name: 'short', term: 'Ti', page: null },
  { name: 'miss', term: 'titanium bar', page: null },
  { name: 'page-first', term: 'L-shape', page: 0 },
  { name: 'page-last', term: 'L-shape', page: MAX_PAGES - 1 },
];

/** Prefix terms (what beginsWith can use), an infix, a 2-letter material and a miss. */
export const PROBE_TERMS = [
  'metal rod U-shape AlTi',
  'metal rod FeMoCo 999mm',
  'FeMoCo 999mm length 99mm',
  'Zn',
  'titanium bar',
];

export const PROBE_PREDICATES: PredicateName[] = [
  'titleContains',
  'titleBeginsWith',
  'shortDescContains',
  'titleMatch',
];
